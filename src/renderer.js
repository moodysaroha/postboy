// PostBoy - Renderer Process JavaScript

class PostBoy {
  constructor() {
    this.history = JSON.parse(localStorage.getItem('api-history') || '[]');
    // Theme removed - dark theme only
    this.sidebarStates = JSON.parse(localStorage.getItem('sidebar-states') || '{}');
    this.isDragging = false;
    this.currentDragTarget = null;
    this.dragTargetElement = null; // Cache the DOM element
    this.dragAnimationFrame = null; // For requestAnimationFrame
    this.lastDragEvent = null; // Cache last mouse event
    this.lastResponseData = null; // Store the last response for saving to collections
    this.lastResponseTimestamp = null; // Track when the last response was received
    this.timestampUpdateInterval = null; // Interval for updating timestamp display
    this.currentCollectionRequestId = null; // Track if current request is from a collection
    this.currentCollectionId = null; // Track which collection the request is from
    this.bodyTypeShortcutsEnabled = false; // Track if body type shortcuts are active
    this.bodyTypeShortcutTimeout = null; // Timeout for body type shortcuts
    
    // Tab management
    this.tabs = new Map();
    this.activeTabId = 'new-request';
    this.tabCounter = 1;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    // Theme setup removed - dark theme only
    this.renderHistory();
    this.setupTabs();
    this.setupKeyValuePairs();
    this.setupCollapsibleSidebars();
    this.setupDragResize();
    this.restoreSidebarStates();
    this.setupSidebarTabs();
    this.setupBodyEditor();
    this.updateTabIndicators();
    this.setupShortcutsPopover();
    this.initializeDefaultTab();
    this.setupChangeDetection();
  }

  setupEventListeners() {
    const newTabBtn = document.querySelector('.new-tab-btn');
    if (newTabBtn) {
      newTabBtn.addEventListener('click', () => {
        this.createNewRequestTab();
      });
    }

    // Setup existing tab click handlers
    document.querySelectorAll('.request-tab').forEach(tab => {
      const tabId = tab.getAttribute('data-tab-id');
      if (tabId) {
        tab.addEventListener('click', (e) => {
          if (!e.target.classList.contains('tab-close-btn')) {
            this.switchToTab(tabId);
          }
        });
        
        const closeBtn = tab.querySelector('.tab-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
          });
        }
      }
    });

    // Setup custom dropdown
    this.setupCustomDropdown();

    // Send request
    document.getElementById('send-btn').addEventListener('click', () => {
      this.sendRequest();
    });

    // Clear history
    document.getElementById('clear-history').addEventListener('click', () => {
      this.clearHistory();
    });

    // URL input enter key
    document.getElementById('url-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendRequest();
      }
    });

    // Global Ctrl+Enter shortcut to send request from anywhere
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.sendRequest();
      }
    });

    this.setupHelpShortcut();

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+I: Focus URL input (but not Ctrl+Shift+I)
      if (e.ctrlKey && !e.shiftKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
          urlInput.focus();
          urlInput.select(); // Also select all text for easy replacement
        }
      }
      
      // Ctrl+S: Save request
      else if (e.ctrlKey && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (window.collectionsManager) {
          window.collectionsManager.saveCurrentRequest();
        }
      }
      
      // Ctrl+H: Focus headers tab
      else if (e.ctrlKey && !e.shiftKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        this.switchTab('request', 'headers');
        setTimeout(() => {
          const firstHeaderInput = document.querySelector('#headers-container .key-input');
          if (firstHeaderInput) {
            firstHeaderInput.focus();
          }
        }, 50);
      }
      
      // Ctrl+B: Focus body tab and enable body type shortcuts
      else if (e.ctrlKey && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        this.switchTab('request', 'body');
        
        // Enable body type shortcuts for a short period
        this.enableBodyTypeShortcuts();
        
        setTimeout(() => {
          // Focus the currently active body input
          const activeBodyInput = document.querySelector('.body-content.active .body-input');
          if (activeBodyInput) {
            activeBodyInput.focus();
          }
        }, 50);
      }
      
      // Ctrl+P: Focus params tab
      else if (e.ctrlKey && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        this.switchTab('request', 'params');
        setTimeout(() => {
          const firstParamInput = document.querySelector('#params-container .key-input');
          if (firstParamInput) {
            firstParamInput.focus();
          }
        }, 50);
      }
      
      // Ctrl+Shift+A: Focus auth tab
      else if (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        this.switchTab('request', 'auth');
        setTimeout(() => {
          // Focus the first input in auth tab if available
          const firstAuthInput = document.querySelector('#auth-tab input, #auth-tab select');
          if (firstAuthInput) {
            firstAuthInput.focus();
          }
        }, 50);
      }
      
      // Ctrl+Shift+C: Switch to Collections tab
      else if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        this.switchSidebarTab('collections');
      }
      
      // Ctrl+Shift+H: Switch to History tab
      else if (e.ctrlKey && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        this.switchSidebarTab('history');
      }
      
      // Body type shortcuts (only when enabled after Ctrl+B)
      else if (this.bodyTypeShortcutsEnabled && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        this.handleBodyTypeShortcut(e.key.toLowerCase());
      }
    });

    // URL input change - parse query params and mark as unsaved
    document.getElementById('url-input').addEventListener('input', () => {
      this.parseUrlParams();
      this.markTabAsUnsaved();
    });

    // URL input paste - handle curl commands
    document.getElementById('url-input').addEventListener('paste', (e) => {
      setTimeout(() => {
        this.parseUrlParams();
      }, 10); // Small delay to ensure pasted content is processed
    });



    // History item click
    document.getElementById('history-list').addEventListener('click', (e) => {
      const historyItem = e.target.closest('.history-item');
      if (historyItem) {
        const index = Array.from(historyItem.parentNode.children).indexOf(historyItem);
        this.loadFromHistory(index);
      }
    });

    // Copy to clipboard
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('copy-btn')) {
        this.copyHeadersToClipboard();
      }
    });

    // Body input syntax highlighting and auto-beautify on paste (for JSON)
    // We'll set this up dynamically when JSON body type is selected
    this.setupBodyInputListeners();


  }

  setupBodyInputListeners() {
    // Setup listeners for JSON body input
    const jsonBodyInput = document.querySelector('#body-json .body-input');
    if (jsonBodyInput) {
      jsonBodyInput.addEventListener('input', () => {
      this.highlightBodyJSON();
      this.updateTabIndicators();
    });
      
      jsonBodyInput.addEventListener('paste', (e) => {
      e.preventDefault();
      
      // Get pasted text
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      
      // Try to beautify immediately if it's JSON
      let finalText = pastedText;
      try {
        const parsed = JSON.parse(pastedText.trim());
        finalText = JSON.stringify(parsed, null, 2);
      } catch (err) {
        // Not JSON, use as-is
      }
      
      // Insert the text
        jsonBodyInput.textContent = finalText;
      
      // Apply syntax highlighting
      this.highlightBodyJSON();
      this.updateTabIndicators();
    });
    }
  }

  setupModalEventListeners() {
    // New Collection Modal
    const newCollectionModal = document.getElementById('new-collection-modal');
    const collectionNameInput = document.getElementById('collection-name-input');
    const createCollectionBtn = document.getElementById('create-collection');
    const cancelCollectionBtn = document.getElementById('cancel-collection');
    const closeCollectionModalBtn = document.getElementById('close-collection-modal');

    // Create collection button
    if (createCollectionBtn) {
      createCollectionBtn.addEventListener('click', () => {
        this.handleCreateCollection();
      });
    }

    // Cancel/Close collection modal
    [cancelCollectionBtn, closeCollectionModalBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.hideNewCollectionModal();
        });
      }
    });

    // Enter key in collection name input
    if (collectionNameInput) {
      collectionNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleCreateCollection();
        }
      });
    }

    // Close modal when clicking outside
    if (newCollectionModal) {
      newCollectionModal.addEventListener('click', (e) => {
        if (e.target === newCollectionModal) {
          this.hideNewCollectionModal();
        }
      });
    }

    // Save Request Modal functionality is handled by CollectionsManager


  }

  // Theme functions removed - dark theme only

  setupTabs() {
    // Request tabs
    document.querySelectorAll('.request-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        this.switchTab('request', tabName);
      });
    });

    // Response tabs
    document.querySelectorAll('.response-tabs .response-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        this.switchResponseTab(tabName);
      });
    });
  }

  switchTab(type, tabName) {
    // Remove active class from all tabs
    document.querySelectorAll(`.${type}-tabs .tab-btn`).forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Hide all tab panes
    document.querySelectorAll(`#headers-tab, #body-tab, #params-tab, #auth-tab`).forEach(pane => {
      pane.classList.remove('active');
    });
    
    // Activate clicked tab
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  switchResponseTab(tabName) {
    // Remove active class from all response tabs
    document.querySelectorAll('.response-tabs .response-tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Hide all response tab panes
    document.querySelectorAll('.response-tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    // Activate clicked tab
    const tabButton = document.querySelector(`.response-tabs [data-tab="${tabName}"]`);
    
    // Handle special case for headers tab (has different ID structure)
    let tabPane;
    if (tabName === 'headers') {
      tabPane = document.getElementById('response-headers-tab');
    } else {
      tabPane = document.getElementById(`${tabName}-tab`);
    }
    
    if (tabButton) tabButton.classList.add('active');
    if (tabPane) tabPane.classList.add('active');
  }

  setupKeyValuePairs() {
    // Add button listeners
    document.querySelectorAll('.add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        this.addKeyValuePair(target);
      });
    });

    // Remove button listeners (event delegation)
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-btn')) {
        e.target.parentElement.remove();
        this.updateTabIndicators();
      }
    });

    // Update indicators when inputs change
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('key-input') || 
          e.target.classList.contains('value-input') ||
          e.target.classList.contains('body-input')) {
        this.updateTabIndicators();
      }
    });
  }

  addKeyValuePair(target) {
    const container = document.getElementById(`${target}-container`);
    const row = document.createElement('div');
    row.className = 'key-value-row';
    row.innerHTML = `
      <input type="text" placeholder="Key" class="key-input" />
      <input type="text" placeholder="Value" class="value-input" />
      <button class="remove-btn">×</button>
    `;
    container.appendChild(row);
    this.updateTabIndicators();
  }

  getKeyValuePairs(containerId) {
    const container = document.getElementById(containerId);
    const pairs = {};
    const rows = container.querySelectorAll('.key-value-row');
    
    rows.forEach(row => {
      const key = row.querySelector('.key-input').value.trim();
      const value = row.querySelector('.value-input').value.trim();
      if (key) {
        pairs[key] = value;
      }
    });
    
    return pairs;
  }

  setKeyValuePairs(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    Object.entries(data || {}).forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'key-value-row';
      row.innerHTML = `
        <input type="text" placeholder="Key" class="key-input" value="${key}" />
        <input type="text" placeholder="Value" class="value-input" value="${value}" />
        <button class="remove-btn">×</button>
      `;
      container.appendChild(row);
    });

    // Add empty row if no data
    if (Object.keys(data || {}).length === 0) {
      this.addKeyValuePair(containerId.replace('-container', ''));
    }
  }

  async sendRequest() {
    const method = this.getMethodValue();
    const url = document.getElementById('url-input').value.trim();
    
    if (!url) {
      await window.modalManager.showWarning(
        'URL Required',
        'Please enter a URL to send the request.'
      );
      document.getElementById('url-input').focus();
      return;
    }

    // Show loading state
    document.body.classList.add('loading');
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;

    try {
      // Get headers and params
      const headers = this.getKeyValuePairs('headers-container');
      const params = this.getKeyValuePairs('params-container');

      // Build URL with params
      let requestUrl = url;
      const urlParams = new URLSearchParams(params);
      if (urlParams.toString()) {
        requestUrl += (url.includes('?') ? '&' : '?') + urlParams.toString();
      }

      // Prepare request options
      const requestOptions = {
        method: method,
        headers: { ...headers }
      };

      // Handle different body types
      const bodyData = this.getRequestBody();
      const bodyType = this.getCurrentBodyType();
      
      if (['POST', 'PUT', 'PATCH'].includes(method) && bodyData.body) {
        requestOptions.body = bodyData.body;
        // Set content type if not already set
        if (bodyData.contentType && !requestOptions.headers['Content-Type']) {
          requestOptions.headers['Content-Type'] = bodyData.contentType;
        }
      }

      // Make request
      const startTime = Date.now();
      const response = await fetch(requestUrl, requestOptions);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Get response data
      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      // Display response (always fully expanded)
      this.displayResponse(response, responseData, responseTime);

      // Store the response data for potential saving to collections
      this.lastResponseData = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        responseTime
      };

      // Add to history
      this.addToHistory({
        method,
        url: requestUrl,
        headers,
        params,
        body: bodyData.body || '',
        bodyType,
        response: this.lastResponseData,
        timestamp: new Date().toISOString()
      });

      // Auto-save to collection if this request came from a collection
      if (this.currentCollectionId && this.currentCollectionRequestId) {
        this.autoSaveToCollection();
      }

    } catch (error) {
      console.error('Request failed:', error);
      this.displayError(error.message);
    } finally {
      // Remove loading state
      document.body.classList.remove('loading');
      sendBtn.disabled = false;
    }
  }

  displayResponse(response, data, responseTime, timestamp = null) {
    // Show the status bar
    document.getElementById('response-status-bar').style.display = 'flex';

    // Make sure we're on the preview tab
    this.switchResponseTab('preview');

    // Update status badge
    const statusBadge = document.getElementById('status-badge');
    statusBadge.textContent = `${response.status} ${response.statusText}`;
    statusBadge.className = 'status-badge ' + (response.ok ? '' : 'error');

    // Update response time and size
    document.getElementById('response-time').textContent = `${responseTime} ms`;
    
    // Calculate response size
    const responseSize = new Blob([typeof data === 'string' ? data : JSON.stringify(data)]).size;
    const sizeFormatted = responseSize < 1024 ? `${responseSize} B` : `${(responseSize / 1024).toFixed(1)} KB`;
    document.getElementById('response-size').textContent = sizeFormatted;

    // Update timestamp - use provided timestamp or current time
    this.lastResponseTimestamp = timestamp || new Date().toISOString();
    this.startTimestampUpdater();

    // Hide empty state and show json container
    const emptyState = document.getElementById('response-empty-state');
    const jsonContainer = document.getElementById('json-container');
    const responseBody = document.getElementById('response-body');
    
    if (emptyState) emptyState.style.display = 'none';
    jsonContainer.style.display = 'block';
    
    // Display response body with proper formatting
    if (data && typeof data === 'object') {
      // Clear any existing content
      responseBody.innerHTML = '';
      
      // Configure original renderjson
      // Always show everything expanded for better visibility
      renderjson.set_icons('▶', '▼')
               .set_show_to_level('all')  // Always show all levels expanded
               .set_max_string_length(1000);  // Show longer strings
      
      // Render the JSON with original renderjson
      const jsonElement = renderjson(data);
      jsonElement.classList.add('renderjson-container');
      
      // Create the two-column layout with separate line numbers
      this.createTwoColumnLayout(responseBody, jsonElement);
    } else {
      // For non-JSON data, create simple line-numbered display
      responseBody.innerHTML = '';
      const textContent = String(data || 'No data');
      const lines = textContent.split('\n');
      
      lines.forEach((line, index) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'simple-line';
        
        const lineNumSpan = document.createElement('span');
        lineNumSpan.className = 'line-number';
        lineNumSpan.textContent = (index + 1).toString().padStart(3, ' ');
        
        const contentSpan = document.createElement('span');
        contentSpan.className = 'line-content';
        contentSpan.textContent = line;
        
        lineDiv.appendChild(lineNumSpan);
        lineDiv.appendChild(contentSpan);
        responseBody.appendChild(lineDiv);
      });
    }

    // Display response headers in table format
    this.displayResponseHeaders(response.headers);

    // Update response headers count
    const headersCount = response.headers ? Object.keys(Object.fromEntries(response.headers.entries())).length : 0;
    const responseHeadersCountElement = document.getElementById('response-headers-count');
    if (responseHeadersCountElement) {
      responseHeadersCountElement.textContent = headersCount.toString();
    }

    // Add to console
    this.addConsoleLog(`${response.status} ${response.statusText} • ${responseTime}ms • ${sizeFormatted}`);
  }

  displayResponseHeaders(headers) {
    const headersTable = document.getElementById('response-headers-table');
    headersTable.innerHTML = '';

    if (headers) {
      Object.entries(Object.fromEntries(headers.entries())).forEach(([name, value]) => {
        const row = document.createElement('div');
        row.className = 'table-row';
        row.innerHTML = `
          <div class="table-cell name">${name}</div>
          <div class="table-cell value">${value}</div>
        `;
        headersTable.appendChild(row);
      });
    }
  }

  syntaxHighlightJSON(json) {
    // Escape HTML first to prevent XSS
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Replace different JSON elements with styled spans
    return json
      // Property names (keys) - including quotes
      .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:')
      // String values - including quotes
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="json-string">$1</span>')
      // Numbers (integers and floats)
      .replace(/:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, ': <span class="json-number">$1</span>')
      // Booleans
      .replace(/:\s*(true|false)\b/g, ': <span class="json-boolean">$1</span>')
      // Null values
      .replace(/:\s*(null)\b/g, ': <span class="json-null">$1</span>')
      // Punctuation
      .replace(/([{}[\],])/g, '<span class="json-punctuation">$1</span>');
  }





  createTwoColumnLayout(container, jsonElement) {
    // Create wrapper for two-column layout
    const wrapper = document.createElement('div');
    wrapper.className = 'json-two-column';
    
    // Create line numbers sidebar
    const lineNumbersSidebar = document.createElement('div');
    lineNumbersSidebar.className = 'line-numbers-sidebar';
    lineNumbersSidebar.id = 'line-numbers-sidebar';
    
    // Create JSON content area
    const jsonContent = document.createElement('div');
    jsonContent.className = 'json-content-area';
    jsonContent.appendChild(jsonElement);
    
    // Add both to wrapper
    wrapper.appendChild(lineNumbersSidebar);
    wrapper.appendChild(jsonContent);
    
    // Add wrapper to container
    container.appendChild(wrapper);
    
    // Generate line numbers based on JSON content
    this.generateLineNumbers(jsonElement, lineNumbersSidebar);
    
    // Setup observers for dynamic updates
    this.setupJsonObserver(jsonElement, lineNumbersSidebar);
  }

  generateLineNumbers(jsonElement, lineNumbersSidebar) {
    // Get the text content and count lines
    const textContent = jsonElement.textContent || '';
    const lines = textContent.split('\n');
    const lineCount = lines.length;
    
    // Generate line numbers
    const lineNumbers = [];
    for (let i = 1; i <= lineCount; i++) {
      lineNumbers.push(`<div class="line-number-item">${i.toString().padStart(3, ' ')}</div>`);
    }
    
    lineNumbersSidebar.innerHTML = lineNumbers.join('');
  }

  setupJsonObserver(jsonElement, lineNumbersSidebar) {
    // Create observer to update line numbers when JSON changes
    const observer = new MutationObserver(() => {
      setTimeout(() => {
        this.generateLineNumbers(jsonElement, lineNumbersSidebar);
      }, 50); // Small delay to let renderjson finish its updates
    });
    
    // Observe changes in the JSON element
    observer.observe(jsonElement, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Also use ResizeObserver for height changes
    const resizeObserver = new ResizeObserver(() => {
      this.generateLineNumbers(jsonElement, lineNumbersSidebar);
    });
    
    resizeObserver.observe(jsonElement);
  }

  addConsoleLog(message) {
    const consoleContent = document.getElementById('console-content');
    const logEntry = document.createElement('div');
    logEntry.className = 'console-log';
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleContent.appendChild(logEntry);
    consoleContent.scrollTop = consoleContent.scrollHeight;
  }

  displayError(message) {
    // Show the status bar
    document.getElementById('response-status-bar').style.display = 'flex';

    // Make sure we're on the preview tab
    this.switchResponseTab('preview');

    const statusBadge = document.getElementById('status-badge');
    statusBadge.textContent = 'Error';
    statusBadge.className = 'status-badge error';

    document.getElementById('response-time').textContent = '0 ms';
    document.getElementById('response-size').textContent = '0 B';
    
    // Set timestamp for errors too
    this.lastResponseTimestamp = new Date().toISOString();
    this.startTimestampUpdater();

    // Hide empty state and show response body
    const emptyState = document.getElementById('response-empty-state');
    const responseBody = document.getElementById('response-body');
    
    if (emptyState) emptyState.style.display = 'none';
    responseBody.style.display = 'block';
    responseBody.textContent = `Error: ${message}`;

    // Clear headers table
    document.getElementById('response-headers-table').innerHTML = '';
    const responseHeadersCountElement = document.getElementById('response-headers-count');
    if (responseHeadersCountElement) {
      responseHeadersCountElement.textContent = '0';
    }

    // Add to console
    this.addConsoleLog(`Error: ${message}`);
  }

  addToHistory(requestData) {
    this.history.unshift(requestData);
    
    // Keep only last 50 requests
    if (this.history.length > 50) {
      this.history = this.history.slice(0, 50);
    }
    
    localStorage.setItem('api-history', JSON.stringify(this.history));
    this.renderHistory();
  }

  renderHistory() {
    const historyList = document.getElementById('history-list');
    
    if (this.history.length === 0) {
      historyList.innerHTML = '<div class="no-history">No requests yet</div>';
      return;
    }

    historyList.innerHTML = this.history.map(item => {
      const statusClass = item.response.status < 400 ? 'success' : 'error';
      const methodClass = item.method.toLowerCase();
      
      return `
        <div class="history-item">
          <div class="method ${methodClass}">${item.method}</div>
          <div class="url">${item.url}</div>
          <div class="status ${statusClass}">${item.response.status}</div>
        </div>
      `;
    }).join('');
  }

  loadFromHistory(index) {
    const item = this.history[index];
    if (!item) return;

    this.lastResponseData = item.response || null;
    
    this.currentCollectionId = null;
    this.currentCollectionRequestId = null;

    // Set method and URL - keep the full URL as stored
    this.setMethodValue(item.method);
    
    // Parse URL to separate base URL and query params
    const url = new URL(item.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
    
    document.getElementById('url-input').value = baseUrl;

    // Set headers
    this.setKeyValuePairs('headers-container', item.headers || {});

    // Extract and set params from URL
    const urlParams = {};
    url.searchParams.forEach((value, key) => {
      urlParams[key] = value;
    });
    
    // Merge URL params with stored params (stored params take precedence)
    const allParams = { ...urlParams, ...(item.params || {}) };
    this.setKeyValuePairs('params-container', allParams);

    // Set body type and content
    const bodyType = item.bodyType || (item.body ? 'json' : 'none'); // Fallback for old history items
    this.setBodyType(bodyType);
    
    if (item.body && bodyType !== 'none') {
      if (bodyType === 'form-urlencoded') {
        // Handle form URL encoded data
        this.setFormUrlEncodedData(item.body);
      } else if (bodyType === 'form-data') {
        // Handle form data (would need more complex restoration)
        console.warn('Form data restoration not fully implemented');
      } else {
        // Handle text-based body types (json, xml, yaml, etc.) with auto-formatting
        this.setBodyContentWithFormatting(bodyType, item.body);
      }
    }
    this.updateTabIndicators(); // Update tab indicators after loading body

    // Display previous response
    if (item.response) {
      this.lastResponseData = item.response;
      this.displayResponse({
        status: item.response.status,
        statusText: item.response.statusText,
        ok: item.response.status < 400,
        headers: new Map(Object.entries(item.response.headers || {}))
      }, item.response.data, item.response.responseTime, item.timestamp);
    }
  }

  async clearHistory() {
    const confirmed = await window.modalManager.confirm(
      'Clear History',
      'Are you sure you want to clear all history?',
      'This action cannot be undone.'
    );
    
    if (confirmed) {
      this.history = [];
      localStorage.removeItem('api-history');
      this.renderHistory();
      this.addConsoleLog('History cleared');
    }
  }

  setupCollapsibleSidebars() {
    // Add event listeners for collapse buttons
    document.querySelectorAll('.collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-target');
        this.toggleSidebar(targetId);
      });
    });
  }

  toggleSidebar(sidebarId) {
    const sidebar = document.getElementById(sidebarId);
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    if (isCollapsed) {
      sidebar.classList.remove('collapsed');
      this.sidebarStates[sidebarId] = { ...this.sidebarStates[sidebarId], collapsed: false };
    } else {
      sidebar.classList.add('collapsed');
      this.sidebarStates[sidebarId] = { ...this.sidebarStates[sidebarId], collapsed: true };
    }
    
    this.saveSidebarStates();
  }

  setupDragResize() {
    const dragHandles = document.querySelectorAll('.drag-handle');
    
    dragHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.startDrag(handle, e);
      });
    });

    // Global mouse events for dragging
    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        // Store the event and request animation frame
        this.lastDragEvent = e;
        if (!this.dragAnimationFrame) {
          this.dragAnimationFrame = requestAnimationFrame(() => {
            this.handleDragOptimized();
          });
        }
      }
    }, { passive: true }); // Passive listener for better performance

    document.addEventListener('mouseup', () => {
      this.endDrag();
    });
  }

  startDrag(handle, event) {
    this.isDragging = true;
    this.currentDragTarget = handle.getAttribute('data-target');
    this.dragTargetElement = document.getElementById(this.currentDragTarget); // Cache element
    handle.classList.add('dragging');
    this.dragTargetElement.classList.add('dragging'); // Add dragging class to sidebar
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    this.startX = event.clientX;
    this.startWidth = this.dragTargetElement.offsetWidth;
    
    // Add will-change for GPU acceleration
    this.dragTargetElement.style.willChange = 'width';
  }

  handleDragOptimized() {
    if (!this.isDragging || !this.lastDragEvent || !this.dragTargetElement) {
      this.dragAnimationFrame = null;
      return;
    }
    
    const deltaX = this.lastDragEvent.clientX - this.startX;
    
    let newWidth;
    if (this.currentDragTarget === 'left-sidebar') {
      newWidth = this.startWidth + deltaX;
    } else {
      newWidth = this.startWidth - deltaX;
    }
    
    // Apply constraints
    newWidth = Math.max(200, Math.min(600, newWidth));
    
    // Use transform for better performance during drag
    this.dragTargetElement.style.width = newWidth + 'px';
    
    // Clear the animation frame
    this.dragAnimationFrame = null;
  }

  endDrag() {
    if (!this.isDragging) return;
    
    // Cancel any pending animation frame
    if (this.dragAnimationFrame) {
      cancelAnimationFrame(this.dragAnimationFrame);
      this.dragAnimationFrame = null;
    }
    
    this.isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Remove dragging class from all handles
    document.querySelectorAll('.drag-handle').forEach(handle => {
      handle.classList.remove('dragging');
    });
    
    // Clean up GPU acceleration hint and dragging class
    if (this.dragTargetElement) {
      this.dragTargetElement.style.willChange = 'auto';
      this.dragTargetElement.classList.remove('dragging');
    
    // Save the new width
      const width = this.dragTargetElement.offsetWidth;
      this.sidebarStates[this.currentDragTarget] = { 
        ...this.sidebarStates[this.currentDragTarget], 
        width: width 
      };
      this.saveSidebarStates();
    }
    
    this.currentDragTarget = null;
    this.dragTargetElement = null;
    this.lastDragEvent = null;
  }

  restoreSidebarStates() {
    Object.keys(this.sidebarStates).forEach(sidebarId => {
      const sidebar = document.getElementById(sidebarId);
      const state = this.sidebarStates[sidebarId];
      
      if (sidebar && state) {
        if (state.width) {
          sidebar.style.width = state.width + 'px';
        }
        if (state.collapsed) {
          sidebar.classList.add('collapsed');
        }
      }
    });
  }

  saveSidebarStates() {
    localStorage.setItem('sidebar-states', JSON.stringify(this.sidebarStates));
  }

  async copyHeadersToClipboard() {
    const headersTable = document.getElementById('response-headers-table');
    const rows = headersTable.querySelectorAll('.table-row');
    
    let headersText = '';
    rows.forEach(row => {
      const name = row.querySelector('.table-cell.name').textContent;
      const value = row.querySelector('.table-cell.value').textContent;
      headersText += `${name}: ${value}\n`;
    });

    try {
      await navigator.clipboard.writeText(headersText);
      this.addConsoleLog('Headers copied to clipboard');
    } catch (err) {
      console.error('Failed to copy headers:', err);
      this.addConsoleLog('Failed to copy headers to clipboard');
    }
  }

  beautifyJSON() {
    const bodyInput = document.querySelector('#body-json .body-input');
    if (!bodyInput) return;
    
    const content = bodyInput.textContent.trim();
    
    if (!content) return;
    
    try {
      const parsed = JSON.parse(content);
      const beautified = JSON.stringify(parsed, null, 2);
      bodyInput.textContent = beautified;
      this.highlightBodyJSON();
      this.updateTabIndicators(); // Update tab indicators after formatting
    } catch (err) {
      // If it's not valid JSON, just format it nicely
      console.log('Not valid JSON, keeping as is');
    }
  }

  // Auto-format body content based on body type
  autoFormatBodyContent(bodyType, content) {
    if (!content || !content.trim()) return content;

    try {
      switch (bodyType) {
        case 'json':
          // Try to parse and format JSON
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed, null, 2);
        
        case 'xml':
          // Basic XML formatting (simple indentation)
          return this.formatXML(content);
        
        case 'html':
          // Basic HTML formatting
          return this.formatHTML(content);
        
        default:
          // For other types, return as-is
          return content;
      }
    } catch (error) {
      // If formatting fails, return original content
      console.warn(`Failed to format ${bodyType}:`, error);
      return content;
    }
  }

  // Simple XML formatter
  formatXML(xml) {
    const PADDING = '  '; // 2 spaces
    const reg = /(>)(<)(\/*)/g;
    let formatted = xml.replace(reg, '$1\r\n$2$3');
    let pad = 0;
    
    return formatted.split('\r\n').map(line => {
      let indent = 0;
      if (line.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (line.match(/^<\/\w/) && pad > 0) {
        pad -= 1;
      } else if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      }
      
      const padding = PADDING.repeat(pad);
      pad += indent;
      return padding + line;
    }).join('\n');
  }

  // Simple HTML formatter
  formatHTML(html) {
    // Use the same XML formatter for basic HTML formatting
    return this.formatXML(html);
  }

  // Set body content with auto-formatting
  setBodyContentWithFormatting(bodyType, content) {
    if (!content) return;

    // Auto-format the content
    const formattedContent = this.autoFormatBodyContent(bodyType, content);
    
    // Set the content in the appropriate body input
    const bodyInput = document.querySelector(`#body-${bodyType} .body-input`);
    if (bodyInput) {
      bodyInput.textContent = formattedContent;
      
      // Apply syntax highlighting for JSON
      if (bodyType === 'json') {
        this.highlightBodyJSON();
      }
    }
  }

  highlightBodyJSON() {
    // Find the currently active body input (JSON type)
    const bodyInput = document.querySelector('#body-json .body-input');
    if (!bodyInput) return;
    
    const content = bodyInput.textContent;
    
    if (!content.trim()) return;
    
    try {
      // Try to parse as JSON first
      JSON.parse(content);
      
      // If it's valid JSON, apply syntax highlighting
      const highlighted = this.syntaxHighlightJSON(content);
      
      // Store cursor position
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const startOffset = range.startOffset;
      
      bodyInput.innerHTML = highlighted;
      
      // Restore cursor position
      try {
        const textNodes = this.getTextNodes(bodyInput);
        let currentOffset = 0;
        let targetNode = null;
        let targetOffset = startOffset;
        
        for (const node of textNodes) {
          if (currentOffset + node.textContent.length >= startOffset) {
            targetNode = node;
            targetOffset = startOffset - currentOffset;
            break;
          }
          currentOffset += node.textContent.length;
        }
        
        if (targetNode) {
          range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent.length));
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (e) {
        // If cursor restoration fails, just continue
      }
    } catch (err) {
      // Not valid JSON, don't highlight
    }
  }

  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    return textNodes;
  }

  setupSidebarTabs() {
    // Sidebar tab switching
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        this.switchSidebarTab(tabName);
      });
    });
  }

  switchSidebarTab(tabName) {
    // Remove active class from all sidebar tabs
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Hide all sidebar tab panes
    document.querySelectorAll('.sidebar-tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    // Activate clicked tab
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }















  parseUrlParams() {
    const urlInput = document.getElementById('url-input');
    const input = urlInput.value.trim();
    
    if (!input) return;
    
    // Check if input is a curl command
    if (input.toLowerCase().startsWith('curl ')) {
      this.parseCurlCommand(input);
      return;
    }
    
    try {
      const urlObj = new URL(input);
      
      // Extract query parameters
      const urlParams = {};
      urlObj.searchParams.forEach((value, key) => {
        urlParams[key] = value;
      });
      
      // If there are query parameters, update the params tab and clean the URL
      if (Object.keys(urlParams).length > 0) {
        // Get existing params from the params container
        const existingParams = this.getKeyValuePairs('params-container');
        
        // Merge URL params with existing params (existing params take precedence)
        const mergedParams = { ...urlParams, ...existingParams };
        
        // Update the params container
        this.setKeyValuePairs('params-container', mergedParams);
        
        // Clean the URL (remove query string)
        const cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
        urlInput.value = cleanUrl;
      }
    } catch (err) {
      // Invalid URL, ignore
    }
    
    this.updateTabIndicators();
  }

  parseCurlCommand(curlCommand) {
    try {
      const parsed = this.curlParser(curlCommand);
      
      if (parsed.url) {
        // Set method
        this.setMethodValue(parsed.method || 'GET');
        
        // Set URL (clean URL without query params)
        const urlInput = document.getElementById('url-input');
        urlInput.value = parsed.url;
        
        // Set headers
        if (parsed.headers && Object.keys(parsed.headers).length > 0) {
          this.setKeyValuePairs('headers-container', parsed.headers);
        }
        
        // Set query parameters
        if (parsed.params && Object.keys(parsed.params).length > 0) {
          this.setKeyValuePairs('params-container', parsed.params);
        }
        
        // Set body
        if (parsed.body) {
          // Determine body type based on content-type or content
          let bodyType = 'json'; // Default to JSON for curl
          
          // Check content-type header to determine body type
          const contentType = parsed.headers['Content-Type'] || parsed.headers['content-type'];
          if (contentType) {
            if (contentType.includes('application/json')) {
              bodyType = 'json';
            } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
              bodyType = 'xml';
            } else if (contentType.includes('text/html')) {
              bodyType = 'html';
            } else if (contentType.includes('text/plain')) {
              bodyType = 'text';
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
              bodyType = 'form-urlencoded';
            }
          }
          
          // Set the body type in dropdown
          this.setBodyType(bodyType);
          
          // Set the body content
          if (bodyType === 'form-urlencoded') {
            // Parse form data and populate form fields
            this.setFormUrlEncodedData(parsed.body);
          } else {
            // Set text content for other types with auto-formatting
            this.setBodyContentWithFormatting(bodyType, parsed.body);
          }
        }
        
        // Set authentication if available
        if (parsed.auth && window.authManager) {
          window.authManager.setAuthData(parsed.auth.type, {
            username: parsed.auth.username,
            password: parsed.auth.password
          });
        }
        
        // Update tab indicators
        this.updateTabIndicators();
        
        // Show success feedback
        this.showCurlParseSuccess();
      }
    } catch (error) {
      console.error('Failed to parse curl command:', error);
      // Show error feedback
      this.showCurlParseError();
    }
  }

  curlParser(curlCommand) {
    const result = {
      method: 'GET',
      url: '',
      headers: {},
      params: {},
      body: '',
      auth: null
    };

    // Remove 'curl' from the beginning and normalize whitespace
    let command = curlCommand.replace(/^curl\s+/i, '').trim();
    
    // Handle different quote types and escape sequences
    const tokens = this.tokenizeCurlCommand(command);
    
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      
      if (token === '-X' || token === '--request') {
        i++;
        if (i < tokens.length) {
          result.method = tokens[i].toUpperCase();
        }
      } else if (token === '-H' || token === '--header') {
        i++;
        if (i < tokens.length) {
          const headerStr = tokens[i];
          const colonIndex = headerStr.indexOf(':');
          if (colonIndex > 0) {
            const key = headerStr.substring(0, colonIndex).trim();
            const value = headerStr.substring(colonIndex + 1).trim();
            result.headers[key] = value;
          }
        }
      } else if (token === '-d' || token === '--data' || token === '--data-raw') {
        i++;
        if (i < tokens.length) {
          result.body = tokens[i];
          // If method wasn't explicitly set and we have data, assume POST
          if (result.method === 'GET') {
            result.method = 'POST';
          }
        }
      } else if (token === '--data-urlencode') {
        i++;
        if (i < tokens.length) {
          // Handle URL encoded data
          const data = tokens[i];
          if (result.body) {
            result.body += '&' + data;
          } else {
            result.body = data;
          }
          if (result.method === 'GET') {
            result.method = 'POST';
          }
        }
      } else if (token === '-F' || token === '--form') {
        i++;
        if (i < tokens.length) {
          // Handle form data
          const formData = tokens[i];
          if (result.body) {
            result.body += '&' + formData;
          } else {
            result.body = formData;
          }
          // Set content-type for form data if not already set
          if (!result.headers['Content-Type']) {
            result.headers['Content-Type'] = 'application/x-www-form-urlencoded';
          }
          if (result.method === 'GET') {
            result.method = 'POST';
          }
        }
      } else if (token === '-u' || token === '--user') {
        i++;
        if (i < tokens.length) {
          const userPass = tokens[i];
          const colonIndex = userPass.indexOf(':');
          if (colonIndex > 0) {
            const username = userPass.substring(0, colonIndex);
            const password = userPass.substring(colonIndex + 1);
            // Set basic auth header
            const credentials = btoa(`${username}:${password}`);
            result.headers['Authorization'] = `Basic ${credentials}`;
            result.auth = {
              type: 'basic',
              username: username,
              password: password
            };
          }
        }
      } else if (token === '-b' || token === '--cookie') {
        i++;
        if (i < tokens.length) {
          result.headers['Cookie'] = tokens[i];
        }
      } else if (token === '-A' || token === '--user-agent') {
        i++;
        if (i < tokens.length) {
          result.headers['User-Agent'] = tokens[i];
        }
      } else if (token === '-e' || token === '--referer') {
        i++;
        if (i < tokens.length) {
          result.headers['Referer'] = tokens[i];
        }
      } else if (token === '--compressed') {
        result.headers['Accept-Encoding'] = 'gzip, deflate, br';
      } else if (token.startsWith('http://') || token.startsWith('https://')) {
        // This is the URL
        const url = new URL(token);
        result.url = `${url.protocol}//${url.host}${url.pathname}`;
        
        // Extract query parameters
        url.searchParams.forEach((value, key) => {
          result.params[key] = value;
        });
      } else if (!token.startsWith('-') && token.includes('://')) {
        // URL without explicit protocol prefix
        try {
          const url = new URL(token);
          result.url = `${url.protocol}//${url.host}${url.pathname}`;
          
          // Extract query parameters
          url.searchParams.forEach((value, key) => {
            result.params[key] = value;
          });
        } catch (e) {
          // Invalid URL, skip
        }
      }
      i++;
    }

    return result;
  }

  tokenizeCurlCommand(command) {
    const tokens = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        continue;
      }
      
      if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        continue;
      }
      
      if (!inQuotes && /\s/.test(char)) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      tokens.push(current.trim());
    }
    
    return tokens;
  }

  showCurlParseSuccess() {
    // Create a temporary success indicator
    const urlInput = document.getElementById('url-input');
    
    urlInput.classList.add('curl-success');
    
    setTimeout(() => {
      urlInput.classList.remove('curl-success');
    }, 2000);
  }

  showCurlParseError() {
    // Create a temporary error indicator
    const urlInput = document.getElementById('url-input');
    
    urlInput.classList.add('curl-error');
    
    setTimeout(() => {
      urlInput.classList.remove('curl-error');
    }, 2000);
  }

  setupShortcutsPopover() {
    const popover = document.getElementById('shortcuts-popover');
    const button = document.querySelector('.shortcuts-btn');
    
    if (!popover || !button) return;
    
    // Position the popover below the button when it opens
    popover.addEventListener('beforetoggle', (e) => {
      if (e.newState === 'open') {
        // Small delay to ensure popover is rendered and has dimensions
        setTimeout(() => {
          const buttonRect = button.getBoundingClientRect();
          const popoverRect = popover.getBoundingClientRect();
          
          // Position below the button with some margin
          const top = buttonRect.bottom + 8;
          
          // Try to right-align with button, but ensure it stays on screen
          let left = buttonRect.right - popoverRect.width;
          
          // Check if it goes off the right edge
          if (left + popoverRect.width > window.innerWidth - 16) {
            left = window.innerWidth - popoverRect.width - 16;
          }
          
          // Check if it goes off the left edge
          if (left < 16) {
            left = 16;
          }
          
          popover.style.position = 'fixed';
          popover.style.top = `${top}px`;
          popover.style.left = `${left}px`;
        }, 0);
      }
    });
  }



  formatRelativeTime(timestamp) {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = now - then;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  startTimestampUpdater() {
    // Clear any existing interval
    if (this.timestampUpdateInterval) {
      clearInterval(this.timestampUpdateInterval);
    }
    
    // Update timestamp immediately
    this.updateResponseTimestamp();
    
    // Update every 10 seconds
    this.timestampUpdateInterval = setInterval(() => {
      this.updateResponseTimestamp();
    }, 10000);
  }

  updateResponseTimestamp() {
    if (this.lastResponseTimestamp) {
      const timestampEl = document.getElementById('response-timestamp');
      if (timestampEl) {
        timestampEl.textContent = this.formatRelativeTime(this.lastResponseTimestamp);
      }
    }
  }

  autoSaveToCollection() {
    if (!window.collectionsManager) return;
    
    const collections = window.collectionsManager.collections;
    const collection = collections.find(c => c.id === this.currentCollectionId);
    
    if (!collection) return;
    
    const request = collection.requests.find(r => r.id === this.currentCollectionRequestId);
    
    if (!request) return;
    
    const method = this.getMethodValue();
    const baseUrl = document.getElementById('url-input')?.value.trim();
    const headers = this.getKeyValuePairs('headers-container');
    const params = this.getKeyValuePairs('params-container');
    const bodyData = this.getRequestBody();
    const body = bodyData.body || '';
    
    let fullUrl = baseUrl;
    const urlParams = new URLSearchParams(params);
    if (urlParams.toString()) {
      fullUrl += (baseUrl.includes('?') ? '&' : '?') + urlParams.toString();
    }
    
    let authData = null;
    if (window.authManager) {
      authData = window.authManager.exportAuthData();
    }
    
    request.method = method;
    request.url = fullUrl;
    request.headers = headers;
    request.params = params;
    request.body = body;
    request.auth = authData;
    request.response = this.lastResponseData;
    request.lastExecuted = new Date().toISOString();
    
    window.collectionsManager.saveCollections();
    
    this.addConsoleLog(`Request "${request.name}" in collection "${collection.name}" auto-updated with latest response`);
  }

  updateTabIndicators() {
    // Update params count
    const paramsCount = this.countKeyValuePairs('params-container');
    const paramsCountElement = document.getElementById('params-count');
    if (paramsCountElement) {
      paramsCountElement.textContent = paramsCount.toString();
      paramsCountElement.style.display = paramsCount > 0 ? 'inline-block' : 'none';
    }

    // Update headers count
    const headersCount = this.countKeyValuePairs('headers-container');
    const headersCountElement = document.getElementById('headers-count');
    if (headersCountElement) {
      headersCountElement.textContent = headersCount.toString();
      headersCountElement.style.display = headersCount > 0 ? 'inline-block' : 'none';
    }

    // Update body indicator
    const bodyIndicator = document.getElementById('body-indicator');
    if (bodyIndicator) {
      // Check if any body content exists across all body types
      const bodyData = this.getRequestBody();
      const hasBody = bodyData.body && bodyData.body.toString().trim().length > 0;
      bodyIndicator.style.display = hasBody ? 'inline-block' : 'none';
    }

    // Update auth indicator
    const authIndicator = document.getElementById('auth-indicator');
    if (authIndicator && window.authManager) {
      const authType = window.authManager.getCurrentAuthType();
      const hasAuth = authType && authType !== 'none';
      authIndicator.style.display = hasAuth ? 'inline-block' : 'none';
    }
  }

  setupBodyEditor() {
    this.setupBodyTypeSelector();
    this.setupFileUpload();
    this.setupFormDataHandlers();
    
    const formatJsonBtn = document.getElementById('body-format-json');
    const toggleViewBtn = document.getElementById('body-toggle-view');
    const bodyInput = document.querySelector('#body-json .body-input');
    const bodyJsonViewer = document.getElementById('body-json-viewer');
    
    let isViewerMode = false;

    // Format JSON button
    if (formatJsonBtn) {
      formatJsonBtn.addEventListener('click', () => {
        this.beautifyJSON(); // Use existing method that includes syntax highlighting
      });
    }

    // Toggle view button
    if (toggleViewBtn) {
      toggleViewBtn.addEventListener('click', () => {
        const content = bodyInput ? bodyInput.textContent.trim() : '';
        
        if (!isViewerMode) {
          // Switch to viewer mode
          if (content) {
            try {
              const parsed = JSON.parse(content);
              this.renderBodyJson(parsed);
              bodyInput.style.display = 'none';
              bodyJsonViewer.style.display = 'block';
              toggleViewBtn.textContent = '📝';
              toggleViewBtn.title = 'Switch to Edit Mode';
              isViewerMode = true;
            } catch (e) {
              // Not valid JSON, can't switch to viewer
              console.warn('Invalid JSON for viewer mode');
            }
          }
        } else {
          // Switch to edit mode
          bodyInput.style.display = 'block';
          bodyJsonViewer.style.display = 'none';
          toggleViewBtn.textContent = '👁️';
          toggleViewBtn.title = 'Switch to View Mode';
          isViewerMode = false;
        }
      });
    }
  }

  setupBodyTypeSelector() {
    // Setup custom dropdown for body type
    this.setupBodyTypeDropdown();
    
    // Initialize with JSON as default for new requests
    this.switchBodyType('json');
  }

  setupBodyTypeDropdown() {
    const dropdown = document.getElementById('body-type-dropdown');
    const selected = dropdown?.querySelector('.dropdown-selected');
    const options = dropdown?.querySelector('.dropdown-options');
    
    if (!dropdown || !selected || !options) return;
    
    // Toggle dropdown
    selected.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    
    // Handle option selection
    options.addEventListener('click', (e) => {
      if (e.target.classList.contains('dropdown-option')) {
        const value = e.target.getAttribute('data-value');
        const text = e.target.textContent;
        
        // Update selected display
        selected.setAttribute('data-value', value);
        selected.querySelector('.dropdown-text').textContent = text;
        
        // Close dropdown
        dropdown.classList.remove('open');
        
        // Switch body type
        this.switchBodyType(value);
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  switchBodyType(type) {
    // Hide all body content sections
    document.querySelectorAll('.body-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // Show selected body type
    const selectedContent = document.getElementById(`body-${type}`);
    if (selectedContent) {
      selectedContent.classList.add('active');
    }
    
    // Show/hide body actions for JSON type
    const bodyActions = document.getElementById('body-actions');
    if (type === 'json') {
      bodyActions.style.display = 'flex';
    } else {
      bodyActions.style.display = 'none';
    }
    
    // Update tab indicators
    this.updateTabIndicators();
  }


  setupFileUpload() {
    const fileInput = document.getElementById('binary-file-input');
    const selectFileBtn = document.querySelector('.select-file-btn');
    const removeFileBtn = document.querySelector('.remove-file-btn');
    const fileInfo = document.getElementById('file-info');
    const filePlaceholder = document.querySelector('.file-upload-placeholder');
    
    if (selectFileBtn) {
      selectFileBtn.addEventListener('click', () => {
        fileInput.click();
      });
    }
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.displayFileInfo(file);
        }
      });
    }
    
    if (removeFileBtn) {
      removeFileBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInfo.style.display = 'none';
        filePlaceholder.style.display = 'block';
      });
    }
  }

  displayFileInfo(file) {
    const fileInfo = document.getElementById('file-info');
    const filePlaceholder = document.querySelector('.file-upload-placeholder');
    const fileName = fileInfo.querySelector('.file-name');
    const fileSize = fileInfo.querySelector('.file-size');
    
    fileName.textContent = file.name;
    fileSize.textContent = this.formatFileSize(file.size);
    
    filePlaceholder.style.display = 'none';
    fileInfo.style.display = 'flex';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  setupFormDataHandlers() {
    // Setup form-data and form-urlencoded add/remove handlers
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('add-btn')) {
        const target = e.target.getAttribute('data-target');
        if (target === 'form-data' || target === 'form-urlencoded') {
          this.addFormField(target);
        }
      }
    });
  }

  addFormField(type) {
    const container = document.getElementById(`${type}-container`);
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'key-value-row';
    
    if (type === 'form-data') {
      row.innerHTML = `
        <input type="text" placeholder="Key" class="key-input" />
        <input type="text" placeholder="Value" class="value-input" />
        <select class="type-select">
          <option value="text">Text</option>
          <option value="file">File</option>
        </select>
        <button class="remove-btn">×</button>
      `;
    } else {
      row.innerHTML = `
        <input type="text" placeholder="Key" class="key-input" />
        <input type="text" placeholder="Value" class="value-input" />
        <button class="remove-btn">×</button>
      `;
    }
    
    container.appendChild(row);
    
    // Add remove handler
    const removeBtn = row.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => {
      row.remove();
      this.updateTabIndicators();
    });
    
    // Focus the new key input
    const keyInput = row.querySelector('.key-input');
    if (keyInput) {
      keyInput.focus();
    }
    
    this.updateTabIndicators();
  }

  getRequestBody() {
    const dropdown = document.getElementById('body-type-dropdown');
    const bodyType = dropdown?.querySelector('.dropdown-selected')?.getAttribute('data-value') || 'none';
    
    switch (bodyType) {
      case 'none':
        return { body: null, contentType: null };
        
      case 'json':
      case 'xml':
      case 'yaml':
      case 'html':
      case 'javascript':
      case 'text':
        const bodyContent = document.querySelector(`#body-${bodyType} .body-input`);
        const content = bodyContent?.textContent.trim() || '';
        
        if (!content) return { body: null, contentType: null };
        
        const contentTypes = {
          text: 'text/plain',
          json: 'application/json',
          xml: 'application/xml',
          html: 'text/html',
          yaml: 'application/x-yaml',
          javascript: 'application/javascript'
        };
        
        return {
          body: content,
          contentType: contentTypes[bodyType] || 'text/plain'
        };
        
      case 'form-urlencoded':
        const formData = this.getKeyValuePairs('form-urlencoded-container');
        const urlEncoded = new URLSearchParams(formData).toString();
        return {
          body: urlEncoded,
          contentType: 'application/x-www-form-urlencoded'
        };
        
      case 'form-data':
        const formDataObj = new FormData();
        const formDataPairs = this.getFormDataPairs('form-data-container');
        
        for (const [key, value, type] of formDataPairs) {
          if (key.trim()) {
            if (type === 'file') {
              // Handle file uploads (would need file input implementation)
              formDataObj.append(key, value);
            } else {
              formDataObj.append(key, value);
            }
          }
        }
        
        return {
          body: formDataObj,
          contentType: null // Let browser set multipart/form-data with boundary
        };
        
      case 'binary':
        const fileInput = document.getElementById('binary-file-input');
        const file = fileInput?.files[0];
        return {
          body: file || null,
          contentType: file ? file.type : null
        };
        
      case 'graphql':
        const query = document.getElementById('graphql-query')?.textContent.trim() || '';
        const variables = document.getElementById('graphql-variables')?.textContent.trim() || '{}';
        
        if (!query) return { body: null, contentType: null };
        
        try {
          const graphqlBody = {
            query: query,
            variables: JSON.parse(variables || '{}')
          };
          
          return {
            body: JSON.stringify(graphqlBody),
            contentType: 'application/json'
          };
        } catch (e) {
          console.error('Invalid GraphQL variables JSON:', e);
          return {
            body: JSON.stringify({ query: query }),
            contentType: 'application/json'
          };
        }
        
      default:
        return { body: null, contentType: null };
    }
  }

  getFormDataPairs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const pairs = [];
    const rows = container.querySelectorAll('.key-value-row');
    
    rows.forEach(row => {
      const keyInput = row.querySelector('.key-input');
      const valueInput = row.querySelector('.value-input');
      const typeSelect = row.querySelector('.type-select');
      
      const key = keyInput?.value.trim() || '';
      const value = valueInput?.value.trim() || '';
      const type = typeSelect?.value || 'text';
      
      if (key || value) {
        pairs.push([key, value, type]);
      }
    });
    
    return pairs;
  }

  getCurrentBodyType() {
    const dropdown = document.getElementById('body-type-dropdown');
    const selected = dropdown?.querySelector('.dropdown-selected');
    return selected?.getAttribute('data-value') || 'none';
  }

  setBodyType(bodyType) {
    // Update the dropdown selection
    const dropdown = document.getElementById('body-type-dropdown');
    const selected = dropdown?.querySelector('.dropdown-selected');
    
    if (selected) {
      selected.setAttribute('data-value', bodyType);
      
      // Update display text
      const typeNames = {
        'none': 'No Body',
        'json': 'JSON',
        'xml': 'XML',
        'yaml': 'YAML',
        'html': 'HTML',
        'javascript': 'JavaScript',
        'text': 'Plain Text',
        'form-data': 'Form Data',
        'form-urlencoded': 'Form URL Encoded',
        'binary': 'File',
        'graphql': 'GraphQL'
      };
      
      selected.querySelector('.dropdown-text').textContent = typeNames[bodyType] || bodyType;
    }
    
    // Switch to the body type
    this.switchBodyType(bodyType);
  }

  setFormUrlEncodedData(formDataString) {
    const container = document.getElementById('form-urlencoded-container');
    if (!container) return;
    
    // Clear existing rows
    container.innerHTML = '';
    
    // Parse the form data
    const params = new URLSearchParams(formDataString);
    
    // Add rows for each parameter
    for (const [key, value] of params.entries()) {
      const row = document.createElement('div');
      row.className = 'key-value-row';
      row.innerHTML = `
        <input type="text" placeholder="Key" class="key-input" value="${key}" />
        <input type="text" placeholder="Value" class="value-input" value="${value}" />
        <button class="remove-btn">×</button>
      `;
      
      // Add remove handler
      const removeBtn = row.querySelector('.remove-btn');
      removeBtn.addEventListener('click', () => {
        row.remove();
        this.updateTabIndicators();
      });
      
      container.appendChild(row);
    }
    
    // Add empty row for new entries
    this.addFormField('form-urlencoded');
  }

  renderBodyJson(jsonData) {
    const bodyJsonViewer = document.getElementById('body-json-viewer');
    if (!bodyJsonViewer) return;

    // Clear existing content
    bodyJsonViewer.innerHTML = '';
    
    // Configure renderjson for body editor
    renderjson.set_icons('▶', '▼')
             .set_show_to_level('all')
             .set_max_string_length(1000);
    
    // Render the JSON
    const jsonElement = renderjson(jsonData);
    jsonElement.classList.add('renderjson-container');
    bodyJsonViewer.appendChild(jsonElement);
  }


  setupCustomDropdown() {
    const dropdown = document.getElementById('method-dropdown');
    const selected = dropdown?.querySelector('.dropdown-selected');
    const options = dropdown?.querySelector('.dropdown-options');
    
    if (!dropdown || !selected || !options) return;

    // Position dropdown options when opening
    const positionDropdown = () => {
      const rect = selected.getBoundingClientRect();
      options.style.top = `${rect.bottom}px`;
      options.style.right = `${window.innerWidth - rect.right}px`;
      options.style.left = 'auto';
      options.style.minWidth = `${Math.max(rect.width, 200)}px`;
    };

    // Click on selected to toggle dropdown
    selected.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      
      if (!isOpen) {
        positionDropdown();
      }
      
      dropdown.classList.toggle('open');
    });

    // Click on option to select it
    options.addEventListener('click', (e) => {
      const option = e.target.closest('.dropdown-option');
      if (!option) return;
      
      const value = option.dataset.value;
      this.setMethodValue(value);
      dropdown.classList.remove('open');
    });

    // Click outside to close dropdown
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });

    // Reposition on window resize
    window.addEventListener('resize', () => {
      if (dropdown.classList.contains('open')) {
        positionDropdown();
      }
    });

    // Keyboard navigation
    dropdown.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.classList.remove('open');
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement === selected) {
          e.preventDefault();
          const isOpen = dropdown.classList.contains('open');
          if (!isOpen) {
            positionDropdown();
          }
          dropdown.classList.toggle('open');
        }
      }
    });
  }

  setMethodValue(value) {
    // Update custom dropdown display
    const dropdown = document.getElementById('method-dropdown');
    const selected = dropdown?.querySelector('.dropdown-selected');
    const text = dropdown?.querySelector('.dropdown-text');
    
    if (selected && text) {
      selected.dataset.value = value;
      text.textContent = value;
    }
  }

  getMethodValue() {
    // Get value from custom dropdown
    const dropdown = document.getElementById('method-dropdown');
    const selected = dropdown?.querySelector('.dropdown-selected');
    return selected?.dataset.value || 'GET';
  }

  countKeyValuePairs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return 0;
    
    const rows = container.querySelectorAll('.key-value-row');
    let count = 0;
    
    rows.forEach(row => {
      const key = row.querySelector('.key-input')?.value.trim();
      if (key) count++;
    });
    
    return count;
  }

  enableBodyTypeShortcuts() {
    // Clear any existing timeout
    if (this.bodyTypeShortcutTimeout) {
      clearTimeout(this.bodyTypeShortcutTimeout);
    }
    
    // Enable body type shortcuts for 2 seconds
    this.bodyTypeShortcutsEnabled = true;
    
    // Disable after timeout
    this.bodyTypeShortcutTimeout = setTimeout(() => {
      this.bodyTypeShortcutsEnabled = false;
    }, 2000);
  }

  handleBodyTypeShortcut(key) {
    // Disable shortcuts after use
    this.bodyTypeShortcutsEnabled = false;
    if (this.bodyTypeShortcutTimeout) {
      clearTimeout(this.bodyTypeShortcutTimeout);
    }

    // Map keys to body types
    const keyToBodyType = {
      'j': 'json',
      'x': 'xml', 
      'y': 'yaml',
      'h': 'html',
      't': 'text',
      'f': 'form-data',
      'u': 'form-urlencoded',
      'i': 'binary',
      'g': 'graphql',
      'n': 'none'
    };

    const bodyType = keyToBodyType[key];
    if (bodyType) {
      this.setBodyType(bodyType);
      
      // Focus the body input after switching
      setTimeout(() => {
        const activeBodyInput = document.querySelector('.body-content.active .body-input');
        if (activeBodyInput) {
          activeBodyInput.focus();
        }
      }, 50);
    }
  }
}

// Load and display app version
async function loadAppVersion() {
  try {
    if (window.electronAPI && window.electronAPI.getVersion) {
      const version = await window.electronAPI.getVersion();
      const versionElement = document.getElementById('app-version');
      if (versionElement) {
        versionElement.textContent = `v${version}`;
      }
    }
  } catch (error) {
    console.error('Failed to load app version:', error);
    // Fallback: keep the placeholder text
  }
}

// Initialize function to avoid duplication
function initializeApp() {
  // Load and display app version
  loadAppVersion();
  
  // Initialize modal manager
  window.modalManager = new ModalManager();
  
  // Initialize auth manager
  window.authManager = new AuthManager();
  window.authManager.init();
  
  // Initialize collections manager
  window.collectionsManager = new CollectionsManager();
  window.collectionsManager.init();
  
  // Initialize main app
  window.postboy = new PostBoy();
  
  // Setup IPC listeners for update notifications
  if (window.electronAPI) {
    window.electronAPI.onUpdateNotification(async (data) => {
      const result = await window.modalManager.showUpdateModal(data);
      // Send response back to main process if needed
      if (result && window.electronAPI.sendUpdateResponse) {
        window.electronAPI.sendUpdateResponse(result);
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // Document already loaded, initialize immediately
  initializeApp();
}

// Ensure input elements have proper cursor behavior after full initialization
function ensureInputCursorBehavior() {
  // Force cursor styles on all text inputs after app loads
  const textInputs = document.querySelectorAll('input[type="text"], input[type="password"], textarea, [contenteditable="true"]');
  textInputs.forEach(input => {
    if (input.getAttribute('contenteditable') === 'true') {
      input.style.cursor = 'text';
    } else {
      input.style.cursor = 'text';
    }
  });
}

// Tab Management Methods
PostBoy.prototype.initializeDefaultTab = function() {
  // Initialize the default tab state
  const defaultTabState = this.getCurrentTabState();
  this.tabs.set('new-request', defaultTabState);
  
  // Update the default tab title to show method
  this.updateCurrentTabTitle();
};

PostBoy.prototype.getCurrentTabState = function() {
  const currentTab = this.tabs.get(this.activeTabId);
  return {
    method: this.getMethodValue(),
    url: document.getElementById('url-input').value,
    params: this.getKeyValuePairs('params-container'),
    headers: this.getKeyValuePairs('headers-container'),
    bodyType: this.getCurrentBodyType(),
    body: this.getRequestBody(),
    auth: window.authManager ? window.authManager.exportAuthData() : { type: 'none', data: {} },
    collectionId: this.currentCollectionId,
    collectionRequestId: this.currentCollectionRequestId,
    savedName: currentTab ? currentTab.savedName : null,
    isSaved: currentTab ? currentTab.isSaved : false,
    hasUnsavedChanges: currentTab ? currentTab.hasUnsavedChanges : false
  };
};

PostBoy.prototype.saveCurrentTabState = function() {
  if (this.activeTabId) {
    const state = this.getCurrentTabState();
    this.tabs.set(this.activeTabId, state);
  }
};

PostBoy.prototype.loadTabState = function(tabId) {
  const state = this.tabs.get(tabId);
  if (!state) return;

  // Set method
  this.setMethodValue(state.method || 'GET');
  
  // Set URL
  document.getElementById('url-input').value = state.url || '';
  
  // Set params
  this.setKeyValuePairs('params-container', state.params || {});
  
  // Set headers
  this.setKeyValuePairs('headers-container', state.headers || {});
  
  // Set body type and content
  if (state.bodyType) {
    this.setBodyType(state.bodyType);
    if (state.body) {
      this.setBodyContentWithFormatting(state.bodyType, state.body);
    }
  }
  
  // Set auth
  if (state.auth && window.authManager) {
    window.authManager.setAuthData(state.auth.type, state.auth.data);
  }
  
  // Set collection tracking
  this.currentCollectionId = state.collectionId || null;
  this.currentCollectionRequestId = state.collectionRequestId || null;
  
  // Update indicators
  this.updateTabIndicators();
};

PostBoy.prototype.createNewRequestTab = function() {
  // Save current tab state before switching
  this.saveCurrentTabState();
  
  // Generate new tab ID
  this.tabCounter++;
  const newTabId = `request-${this.tabCounter}`;
  
  // Create new tab element
  this.createTabElement(newTabId, `Request ${this.tabCounter}`);
  
  // Create empty state for new tab
  const newTabState = {
    method: 'GET',
    url: '',
    params: {},
    headers: {},
    bodyType: 'json',
    body: '',
    auth: { type: 'none', data: {} },
    collectionId: null,
    collectionRequestId: null,
    savedName: null,
    isSaved: false,
    hasUnsavedChanges: false
  };
  
  // Store new tab state
  this.tabs.set(newTabId, newTabState);
  
  // Switch to new tab
  this.switchToTab(newTabId);
};

PostBoy.prototype.createTabElement = function(tabId, title) {
  const tabsList = document.querySelector('.request-tabs-list');
  
  const tabElement = document.createElement('div');
  tabElement.className = 'request-tab';
  tabElement.setAttribute('data-tab-id', tabId);
  
  // Create initial title with method
  const method = 'GET'; // New tabs default to GET
  const methodColor = this.getMethodColor(method);
  const methodSpan = `<span style="color: ${methodColor}; font-weight: 600;">${method}</span>`;
  const nameSpan = `<span>${title}</span>`;
  
  tabElement.innerHTML = `
    <span class="tab-title">${methodSpan} ${nameSpan}</span>
    <button class="tab-close-btn">&times;</button>
  `;
  
  // Add click handler for tab switching
  tabElement.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-close-btn')) {
      this.switchToTab(tabId);
    }
  });
  
  // Add close handler
  const closeBtn = tabElement.querySelector('.tab-close-btn');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    this.closeTab(tabId);
  });
  
  tabsList.appendChild(tabElement);
};

PostBoy.prototype.switchToTab = function(tabId) {
  // Save current tab state
  this.saveCurrentTabState();
  
  // Update active tab
  document.querySelectorAll('.request-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  const targetTab = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }
  
  // Update active tab ID
  this.activeTabId = tabId;
  
  // Load tab state
  this.loadTabState(tabId);
  
  // Clear response (new tab should not show previous response)
  this.clearResponse();
};

PostBoy.prototype.closeTab = function(tabId) {
  // If it's the only tab, create a new one and then close this one
  if (this.tabs.size <= 1) {
    // Create a new tab first
    this.tabCounter++;
    const newTabId = `request-${this.tabCounter}`;
    this.createTabElement(newTabId, `Request ${this.tabCounter}`);
    
    // Create empty state for new tab
    const newTabState = {
      method: 'GET',
      url: '',
      params: {},
      headers: {},
      bodyType: 'json',
      body: '',
      auth: { type: 'none', data: {} },
      collectionId: null,
      collectionRequestId: null,
      savedName: null,
      isSaved: false,
      hasUnsavedChanges: false
    };
    
    this.tabs.set(newTabId, newTabState);
    this.switchToTab(newTabId);
  }
  
  // Remove tab from DOM
  const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (tabElement) {
    tabElement.remove();
  }
  
  // Remove from tabs map
  this.tabs.delete(tabId);
  
  // If closing active tab and there are other tabs, switch to another tab
  if (this.activeTabId === tabId && this.tabs.size > 0) {
    // Switch to the first available tab
    const firstTabId = this.tabs.keys().next().value;
    if (firstTabId) {
      this.switchToTab(firstTabId);
    }
  }
};

PostBoy.prototype.clearResponse = function() {
  // Clear response display
  const responseEmptyState = document.getElementById('response-empty-state');
  const jsonContainer = document.getElementById('json-container');
  const responseHeadersTable = document.getElementById('response-headers-table');
  
  if (responseEmptyState) responseEmptyState.style.display = 'block';
  if (jsonContainer) {
    jsonContainer.style.display = 'none';
    jsonContainer.innerHTML = '';
  }
  if (responseHeadersTable) {
    responseHeadersTable.innerHTML = '';
  }
  
  // Reset response headers count
  const responseHeadersCount = document.getElementById('response-headers-count');
  if (responseHeadersCount) {
    responseHeadersCount.textContent = '0';
  }
  
  // Clear any response data
  this.lastResponseData = null;
  this.lastResponseTimestamp = null;
};

PostBoy.prototype.updateTabTitle = function(tabId, name, isSaved, hasUnsavedChanges) {
  
  const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (!tabElement) {
    console.log(`Tab element not found for tabId: ${tabId}`);
    return;
  }
  
  const titleElement = tabElement.querySelector('.tab-title');
  if (!titleElement) {
    console.log(`Title element not found for tabId: ${tabId}`);
    return;
  }
  
  // Update tab state
  const tabState = this.tabs.get(tabId);
  if (tabState) {
    tabState.savedName = name;
    tabState.isSaved = isSaved;
    tabState.hasUnsavedChanges = hasUnsavedChanges;
  }
  
  // Get current method for coloring
  const currentMethod = this.getMethodValue() || 'GET';
  const methodColor = this.getMethodColor(currentMethod);
  
  // Determine display name
  let displayName = name || this.getDefaultTabName(tabId);
  
  // Add unsaved indicator
  if (hasUnsavedChanges && !isSaved) {
    displayName = displayName + ' *';
  }
  
  // Create HTML with colored method and name
  const methodSpan = `<span style="color: ${methodColor}; font-weight: 600;">${currentMethod}</span>`;
  
  // Apply italic styling to the name span if unsaved
  const styledNameSpan = hasUnsavedChanges && !isSaved 
    ? `<span style="font-style: italic;">${displayName}</span>`
    : `<span>${displayName}</span>`;
  
  // Update title HTML with proper styling
  titleElement.innerHTML = `${methodSpan} ${styledNameSpan}`;
  
  // Also apply italic to the entire title element as backup
  if (hasUnsavedChanges && !isSaved) {
    titleElement.style.fontStyle = 'italic';
  } else {
    titleElement.style.fontStyle = 'normal';
  }
};

PostBoy.prototype.getMethodColor = function(method) {
  const colors = {
    'GET': 'var(--success-color)',
    'POST': 'var(--success-color)', 
    'PUT': '#ff9500',
    'DELETE': 'var(--error-color)',
    'PATCH': 'var(--warning-color)',
    'OPTIONS': '#17a2b8',
    'HEAD': '#6c757d'
  };
  return colors[method.toUpperCase()] || 'var(--text-primary)';
};

PostBoy.prototype.getDefaultTabName = function(tabId) {
  if (tabId === 'new-request') {
    return 'New Request';
  }
  // Extract number from request-X format
  const match = tabId.match(/request-(\d+)/);
  return match ? `Request ${match[1]}` : 'Request';
};

PostBoy.prototype.markTabAsUnsaved = function(tabId) {
  const targetTabId = tabId || this.activeTabId;
  const tabState = this.tabs.get(targetTabId);
  if (tabState) {
    const name = tabState.savedName || this.getDefaultTabName(targetTabId);
    const isSaved = false;
    this.updateTabTitle(targetTabId, name, isSaved, true);
  }
};

PostBoy.prototype.markTabAsSaved = function(tabId, savedName) {
  this.updateTabTitle(tabId || this.activeTabId, savedName, true, false);
};

PostBoy.prototype.updateCurrentTabTitle = function() {
  const tabState = this.tabs.get(this.activeTabId);
  if (tabState) {
    const name = tabState.savedName || this.getDefaultTabName(this.activeTabId);
    this.updateTabTitle(this.activeTabId, name, tabState.isSaved, tabState.hasUnsavedChanges);
  }
};

PostBoy.prototype.setupChangeDetection = function() {
  // Method dropdown change
  const methodDropdown = document.getElementById('method-dropdown');
  if (methodDropdown) {
    methodDropdown.addEventListener('click', () => {
      // Use setTimeout to detect after the value changes
      setTimeout(() => {
        this.markTabAsUnsaved();
        // Also update the tab title to reflect the new method color
        this.updateCurrentTabTitle();
      }, 10);
    });
  }
  
  // Body type dropdown change
  const bodyTypeDropdown = document.getElementById('body-type-dropdown');
  if (bodyTypeDropdown) {
    bodyTypeDropdown.addEventListener('click', () => {
      setTimeout(() => this.markTabAsUnsaved(), 10);
    });
  }
  
  // Key-value pair changes (params, headers)
  const containers = ['params-container', 'headers-container', 'form-data-container', 'form-urlencoded-container'];
  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
      // Use event delegation for dynamic inputs
      container.addEventListener('input', () => {
        this.markTabAsUnsaved();
      });
      container.addEventListener('change', () => {
        this.markTabAsUnsaved();
      });
    }
  });
  
  // Body content changes
  const bodyInputs = document.querySelectorAll('.body-input');
  bodyInputs.forEach(input => {
    input.addEventListener('input', () => {
      this.markTabAsUnsaved();
    });
    input.addEventListener('paste', () => {
      setTimeout(() => this.markTabAsUnsaved(), 10);
    });
  });
  
  // File input changes
  const fileInput = document.getElementById('binary-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      this.markTabAsUnsaved();
    });
  }
  
  // Auth changes detection
  this.setupAuthChangeDetection();
};

PostBoy.prototype.setupHelpShortcut = function() {
  let helpSequence = '';
  let helpTimeout = null;
  
  document.addEventListener('keydown', (e) => {
    if (helpTimeout) {
      clearTimeout(helpTimeout);
    }
    
    // Only process single character keys (not modifiers, arrows, etc.)
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const char = e.key.toUpperCase();
      helpSequence += char;
      
      // console.log(`HELP sequence: "${helpSequence}"`); // Debug log
      
      if (helpSequence.endsWith('PPPP')) {
        e.preventDefault();
        e.stopPropagation();
        
        // If we're in a text input, handle it specially
        const isInTextInput = e.target && (
          e.target.tagName === 'INPUT' || 
          e.target.tagName === 'TEXTAREA' || 
          e.target.contentEditable === 'true'
        );
        
        if (isInTextInput) {
          // Remove "PPP" that might have been typed before the prevented "P"
          setTimeout(() => {
            const currentValue = e.target.value || e.target.textContent || '';
            if (currentValue.toUpperCase().endsWith('PPP')) {
              if (e.target.value !== undefined) {
                e.target.value = currentValue.slice(0, -3);
              } else if (e.target.textContent !== undefined) {
                e.target.textContent = currentValue.slice(0, -3);
              }
            }
          }, 0);
        }
        
        // console.log('About to call openShortcutsPopover');
        this.openShortcutsPopover();
        helpSequence = '';
        return;
      }
      
      // Keep last 10 chars to prevent memory issues
      if (helpSequence.length > 10) {
        helpSequence = helpSequence.slice(-10);
      }
    }
    
    // Reset after 2 seconds of inactivity
    helpTimeout = setTimeout(() => {
      helpSequence = '';
      // console.log('HELP sequence reset');
    }, 2000);
  });
};

PostBoy.prototype.openShortcutsPopover = function() {
  const keyboardIcon = document.querySelector('.shortcuts-btn');
  const popover = document.getElementById('shortcuts-popover');
  
  if (keyboardIcon && popover) {
    // Show the popover
    try {
      popover.showPopover();
    } catch (error) {
      console.error('Error calling showPopover:', error);
      // Fallback: just make it visible
      popover.style.display = 'block';
      popover.style.visibility = 'visible';
    }
    
    // Position it properly (reuse existing positioning logic)
    const iconRect = keyboardIcon.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    
    // Calculate position below the icon
    let top = iconRect.bottom + 8;
    let left = iconRect.left + (iconRect.width / 2) - (popoverRect.width / 2);
    
    // Ensure popover stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if off-screen
    if (left < 10) {
      left = 10;
    } else if (left + popoverRect.width > viewportWidth - 10) {
      left = viewportWidth - popoverRect.width - 10;
    }
    
    // Adjust vertical position if off-screen
    if (top + popoverRect.height > viewportHeight - 10) {
      top = iconRect.top - popoverRect.height - 8;
    }
    
    // Apply positioning
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    
    // console.log('HELP shortcut triggered - popover positioned');
  }
};

PostBoy.prototype.setupAuthChangeDetection = function() {
  // Auth type dropdown change
  const authTypeSelect = document.getElementById('auth-type');
  if (authTypeSelect) {
    authTypeSelect.addEventListener('change', () => {
      this.markTabAsUnsaved();
      // Also set up listeners for the new auth form that will be created
      setTimeout(() => this.setupDynamicAuthListeners(), 100);
    });
  }
  
  // Set up listeners for any existing auth content
  this.setupDynamicAuthListeners();
  
  // Use event delegation on the auth-content container for dynamically created inputs
  const authContent = document.getElementById('auth-content');
  if (authContent) {
    authContent.addEventListener('input', (e) => {
      // Mark as unsaved for any input in auth content
      if (e.target.matches('input, textarea, select')) {
        this.markTabAsUnsaved();
      }
    });
    
    authContent.addEventListener('change', (e) => {
      // Handle select dropdowns and other form elements
      if (e.target.matches('select, input[type="checkbox"], input[type="radio"]')) {
        this.markTabAsUnsaved();
      }
    });
  }
};

PostBoy.prototype.setupDynamicAuthListeners = function() {
  // Set up listeners for specific auth input IDs that are created dynamically
  const authInputIds = [
    'auth-username', 'auth-password',  // Basic Auth
    'auth-token',                      // Bearer Token
    'auth-key', 'auth-value', 'auth-location'  // API Key
  ];
  
  authInputIds.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input && !input.hasAttribute('data-unsaved-listener')) {
      // Mark with attribute to avoid duplicate listeners
      input.setAttribute('data-unsaved-listener', 'true');
      
      input.addEventListener('input', () => {
        this.markTabAsUnsaved();
      });
      
      if (input.tagName === 'SELECT') {
        input.addEventListener('change', () => {
          this.markTabAsUnsaved();
        });
      }
    }
  });
};

// Run cursor fix after a short delay to ensure everything is loaded
setTimeout(() => {
  ensureInputCursorBehavior();
}, 1000);
