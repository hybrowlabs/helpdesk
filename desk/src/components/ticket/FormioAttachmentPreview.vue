<template>
  <div>
    <Teleport v-for="target in targets" :key="target.id" :to="`#${target.id}`">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between w-full py-2 px-1 gap-3 group">
        
        <div class="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
           <div class="flex items-center justify-center p-2 bg-gray-100/80 rounded-md flex-shrink-0 text-gray-500 group-hover:text-gray-700 transition-colors">
              <FeatherIcon name="file" class="w-4 h-4" />
           </div>
           <span 
             class="text-sm font-medium text-gray-700 truncate cursor-pointer hover:underline hover:text-gray-900 transition-colors" 
             @click.stop.prevent="viewAttachment(target)"
             :title="target.name"
           >
             {{ target.name }}
           </span>
        </div>
        
        <div class="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" class="text-gray-600 hover:text-gray-900 h-8 px-2" @click.stop.prevent="viewAttachment(target)">
            <template #prefix>
              <FeatherIcon name="eye" class="h-4 w-4" />
            </template>
            <span class="hidden sm:inline">View</span>
          </Button>
          <Button variant="ghost" class="text-gray-600 hover:text-gray-900 h-8 px-2" @click.stop.prevent="downloadAttachment(target)">
            <template #prefix>
              <FeatherIcon name="download" class="h-4 w-4" />
            </template>
            <span class="hidden sm:inline">Download</span>
          </Button>
        </div>
        
      </div>
    </Teleport>

    <!-- Preview Modal -->
    <Dialog v-model="showPreview" :options="{ title: previewFile?.name || 'Attachment Preview', size: '3xl' }">
      <template #body-content>
        <div class="w-full flex flex-col items-center justify-center py-4 bg-gray-50 rounded-lg min-h-[50vh] max-h-[75vh] overflow-auto relative">
          <!-- Loading Overlay -->
          <div v-if="loadingPreview" class="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/80 z-10 backdrop-blur-sm">
             <div class="w-8 h-8 rounded-full border-4 border-gray-200 border-t-gray-700 animate-spin mb-3"></div>
             <span class="text-sm font-medium text-gray-500">Loading Preview...</span>
          </div>

          <iframe 
            v-if="previewType === 'pdf'" 
            :src="previewUrl" 
            class="w-full min-h-[65vh] border-0 bg-white"
            title="PDF Preview"
          ></iframe>
          <div 
            v-else-if="previewType === 'text'" 
            class="w-full min-h-[50vh] max-h-[70vh] bg-white overflow-auto rounded-lg text-left border border-gray-200 shadow-sm relative block"
          >
            <!-- Graceful CSV Table Viewer -->
            <table v-if="isCsvFileType" class="min-w-full divide-y divide-gray-200 text-sm">
               <thead class="bg-gray-50 sticky top-0 z-10 drop-shadow-sm">
                  <tr>
                    <th v-for="(col, i) in csvHeaders" :key="'h_'+i" class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-gray-100 border-b border-gray-200">
                      {{ col || `Col ${i+1}` }}
                    </th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-gray-200 bg-white">
                  <tr v-for="(row, r) in csvRows" :key="'r_'+r" class="hover:bg-blue-50/50 transition-colors">
                    <td v-for="(cell, c) in row" :key="'c_'+c" class="px-4 py-2.5 whitespace-nowrap text-gray-600 border-r border-gray-100 last:border-r-0">
                      {{ cell }}
                    </td>
                  </tr>
               </tbody>
            </table>
            
            <!-- Standard Code/Text Viewer with padding -->
            <pre v-else class="text-xs sm:text-sm text-gray-800 whitespace-pre overflow-visible text-left font-mono p-4 m-0">{{ textContent }}</pre>
          </div>
          <img 
            v-else-if="previewType === 'image'" 
            :src="previewUrl" 
            class="max-w-full max-h-[65vh] object-contain"
            alt="Image Preview"
          />
          <video 
            v-else-if="previewType === 'video'" 
            :src="previewUrl" 
            controls 
            class="max-w-full max-h-[70vh]"
          ></video>
          <div v-else class="text-gray-500 py-10 flex flex-col justify-center items-center">
            <FeatherIcon name="file" class="w-12 h-12 mb-3 text-gray-400" />
            <p class="text-base text-gray-600">Preview not supported for this file type.</p>
            <Button
              variant="solid"
              class="mt-4"
              @click="downloadAttachment(previewFile!)"
            >
              <template #prefix>
                <FeatherIcon name="download" class="h-4 w-4" />
              </template>
              Download Instead
            </Button>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { Button, Dialog } from 'frappe-ui';

const props = defineProps({
  containerRef: {
    type: [Object, Element, null],
    required: false,
    default: null
  },
  formKey: {
    type: String,
    required: false,
    default: ''
  }
});

interface Target {
  id: string;
  url: string;
  name: string;
  type: string;
}

const targets = ref<Target[]>([]);
let observer: MutationObserver | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const showPreview = ref(false);
const previewUrl = ref('');
const previewType = ref('');
const previewFile = ref<Target | null>(null);

const SUPPORTED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const SUPPORTED_VIDEO_TYPES = ['mp4', 'webm', 'ogg', 'mov'];
const SUPPORTED_TEXT_TYPES = ['txt', 'csv', 'json', 'log'];

function getFileType(text: string) {
  text = text.toLowerCase();
  
  // Use regex with word boundaries to extract type no matter if there are newlines or spaces after
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)\b/i.test(text)) return 'image';
  if (/\.(mp4|webm|ogg|mov)\b/i.test(text)) return 'video';
  if (/\.(txt|csv|json|log)\b/i.test(text)) return 'text';
  if (/\.(pdf)\b/i.test(text)) return 'pdf';
  
  return 'unknown';
}

const loadingPreview = ref(false);
const textContent = ref('');
const isCsvFileType = ref(false);
const csvData = ref<string[][]>([]);

const csvHeaders = computed(() => csvData.value.length > 0 ? csvData.value[0] : []);
const csvRows = computed(() => csvData.value.length > 1 ? csvData.value.slice(1) : []);

function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.join('').trim() !== '') rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else if (char === '\r' && !inQuotes) {
      // ignore CR
    } else {
      currentCell += char;
    }
  }
  
  if (currentRow.length > 0 || currentCell !== '') {
    currentRow.push(currentCell.trim());
    if (currentRow.join('').trim() !== '') rows.push(currentRow);
  }
  return rows;
}

function viewAttachment(target: Target) {
  previewFile.value = target;
  previewUrl.value = '';
  textContent.value = '';
  isCsvFileType.value = false;
  csvData.value = [];
  previewType.value = target.type;
  
  showPreview.value = true;
  loadingPreview.value = true;

  if (target.type === 'text') {
    fetch(target.url)
      .then(res => {
        if (!res.ok) throw new Error('Response error');
        return res.text();
      })
      .then(text => {
        textContent.value = text;
        const nameFallback = (target.name || '').toLowerCase();
        if (nameFallback.endsWith('.csv')) {
           isCsvFileType.value = true;
           csvData.value = parseCSV(text);
        } else if (nameFallback.endsWith('.json')) {
           try {
             textContent.value = JSON.stringify(JSON.parse(text), null, 2);
           } catch {
             // Leave raw text on parser error
           }
        }
      })
      .catch(err => {
        console.error('Failed to fetch text content:', err);
        textContent.value = 'Error: Failed to load file content for preview.';
      })
      .finally(() => {
        loadingPreview.value = false;
      });
  } else if (target.type === 'image' || target.type === 'pdf') {
    fetch(target.url)
      .then(res => {
        if (!res.ok) throw new Error('Response error');
        return res.blob();
      })
      .then(blob => {
        previewUrl.value = URL.createObjectURL(blob);
      })
      .catch(err => {
        console.error('Failed to create Blob URL:', err);
        previewUrl.value = target.url; // fallback to generic URL
      })
      .finally(() => {
        loadingPreview.value = false;
      });
  } else {
    previewUrl.value = target.url;
    loadingPreview.value = false;
  }
}

function downloadAttachment(target: Target) {
  const a = document.createElement('a');
  a.href = target.url;
  a.download = target.name || 'download';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function scanForAttachments() {
  // If dialog is not mounted or element isn't there
  const container = props.containerRef ? 
    (props.containerRef instanceof HTMLElement ? props.containerRef : (props.containerRef?.$el || document.body)) 
    : document.body;
    
  if (!container) return;

  // Hide Formio's native column headers ('File Name', 'Size') to perfectly clean up the UI
  const possibleHeaders = container.querySelectorAll('.formio-component-file .list-group-header, .formio-component-file .list-group-item');
  possibleHeaders.forEach(el => {
    if (!el.querySelector('a, [href]')) {
      const text = el.textContent || '';
      if ((text.includes('File') || text.includes('Name')) && text.includes('Size')) {
        (el as HTMLElement).style.display = 'none';
      }
    }
  });

  // Sometimes formio takes a moment to render list items, so query them
  const listItems = container.querySelectorAll('.formio-component-file .list-group-item, .formio-component-file .formio-file-item');
  
  const newTargets: Target[] = [];
  
  listItems.forEach((li: HTMLElement, index: number) => {
    let targetContainer = li.querySelector('.formio-attachment-preview');
    if (!targetContainer) {
      targetContainer = document.createElement('div');
      targetContainer.className = 'formio-attachment-preview w-full block';
      const uniqueId = `formio-preview-${Math.random().toString(36).substr(2, 9)}-${index}`;
      targetContainer.id = uniqueId;
      li.appendChild(targetContainer);
    }
    
    // Attempt to locate the link natively created by Formio
    const link = li.querySelector('a, [href]');
    if (link && link.getAttribute('href')) {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('javascript:')) return;
      
      const url = href;
      const nameElement = li.querySelector('.formio-file-name, .list-group-item-heading') || link;
      let name = nameElement.textContent?.trim() || 'Attachment';
      
      // Clean up "Press to open" prefix usually found in Formio/Frappe customized views
      name = name.replace(/^Press to open\s+/i, '');
      if (name.includes(' (')) name = name.substring(0, name.lastIndexOf(' (')).trim();
      
      const type = getFileType(name);
      
      const targetObj = {
        id: targetContainer.id,
        url,
        name,
        type
      };
      
      newTargets.push(targetObj);

      // Definitively block formio's UI behaviors by hiding everything except our inserted target container
      Array.from(li.childNodes).forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          child.textContent = '';
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          if (!el.classList.contains('formio-attachment-preview')) {
            el.style.display = 'none';
          }
        }
      });
    }
  });

  // Keep teleport targets updated
  targets.value = newTargets;
}

const debouncedScan = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    scanForAttachments();
  }, 100);
};

onMounted(() => {
  debouncedScan();
  
  observer = new MutationObserver(() => {
    debouncedScan();
  });
  
  const container = props.containerRef ? 
    (props.containerRef instanceof HTMLElement ? props.containerRef : (props.containerRef?.$el || document.body)) 
    : document.body;

  if (container) {
    observer.observe(container, { childList: true, subtree: true });
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
  if (timer) {
    clearTimeout(timer);
  }
});

watch(() => props.formKey, () => {
  nextTick(() => {
    debouncedScan();
  });
});
</script>
