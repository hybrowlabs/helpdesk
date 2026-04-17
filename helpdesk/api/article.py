import frappe
from frappe import _

from helpdesk.search import NUM_RESULTS

try:
    from textblob import TextBlob
    from textblob.exceptions import MissingCorpusError
    HAS_TEXTBLOB = True
except ImportError:
    HAS_TEXTBLOB = False


def get_nouns(blob):
    try:
        return [word for word, pos in blob.pos_tags if pos[0] == "N"]
    except LookupError:
        return []


def get_noun_phrases(blob):
    try:
        return blob.noun_phrases
    except (LookupError, Exception):
        return []


def _search_via_redisearch(query: str, qtype="and"):
    """Try RediSearch-based search. Raises exception if RediSearch is unavailable."""
    from helpdesk.search import search as hd_search
    return hd_search(query, only_articles=True, qtype=qtype)


def _search_via_sql(query: str) -> list:
    """Fallback search using SQL LIKE when RediSearch is not available."""
    terms = query.strip().split()
    if not terms:
        return []

    filters = {"status": "Published"}
    or_filters = []
    for term in terms:
        like_term = f"%{term}%"
        or_filters.append(["title", "like", like_term])
        or_filters.append(["content", "like", like_term])

    articles = frappe.get_all(
        "HD Article",
        filters=filters,
        or_filters=or_filters,
        fields=["name", "title", "content", "category", "modified"],
        order_by="modified desc",
        limit=NUM_RESULTS,
    )

    items = []
    for article in articles:
        # Strip HTML from content for snippet
        content = frappe.utils.strip_html_tags(article.content or "")
        snippet = content[:200] + "..." if len(content) > 200 else content
        items.append({
            "id": article.name,
            "name": article.name,
            "doctype": "HD Article",
            "title": article.title,
            "description": snippet,
            "category": article.category,
        })

    return items


def search_with_enough_results(
    prev_res: list, query: str, qtype="and"
) -> tuple[list, bool]:
    out = _search_via_redisearch(query, qtype=qtype)
    if not out:
        return prev_res, len(prev_res) == NUM_RESULTS
    items = prev_res + out[0].get("items", [])
    items = list({v["id"]: v for v in items}.values())[:NUM_RESULTS]
    return items, len(items) == NUM_RESULTS


@frappe.whitelist()
def search(query: str) -> list:
    query = query.strip().lower()
    if not query:
        return []

    # Try RediSearch first, fall back to SQL
    try:
        ret, enough = search_with_enough_results([], query)
        if enough:
            return ret
        if HAS_TEXTBLOB:
            blob = TextBlob(query)
            if noun_phrases := get_noun_phrases(blob):
                q = " ".join(noun_phrases)
                ret, enough = search_with_enough_results(ret, q)
                if enough:
                    return ret
                ret, enough = search_with_enough_results(ret, q, qtype="or")
                if enough:
                    return ret
            if nouns := get_nouns(blob):
                q = " ".join(nouns)
                ret, enough = search_with_enough_results(ret, q)
                if enough:
                    return ret
                ret, enough = search_with_enough_results(ret, q, qtype="or")
        return ret
    except Exception:
        # RediSearch unavailable — use SQL fallback
        return _search_via_sql(query)
