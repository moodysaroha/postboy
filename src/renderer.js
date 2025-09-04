// PostBoy - Renderer Process JavaScript

class PostBoy {
  constructor() {
    this.history = JSON.parse(localStorage.getItem('api-history') || '[]');
    // Theme removed - dark theme only
    this.sidebarStates = JSON.parse(localStorage.getItem('sidebar-states') || '{}');
    this.isDragging = false;
    this.currentDragTarget = null;
    this.lastResponseData = null; // Store the last response for saving to collections
    this.lastResponseTimestamp = null; // Track when the last response was received
    this.timestampUpdateInterval = null; // Interval for updating timestamp display
    this.currentCollectionRequestId = null; // Track if current request is from a collection
    this.currentCollectionId = null; // Track which collection the request is from
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
    this.updateTabIndicators();
  }

  setupEventListeners() {
    // Theme toggle removed - dark theme only

    // New tab button
    const newTabBtn = document.querySelector('.new-tab-btn');
    if (newTabBtn) {
      newTabBtn.addEventListener('click', () => {
        this.createNewRequestTab();
      });
    }

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

    // URL input change - parse query params
    document.getElementById('url-input').addEventListener('input', () => {
      this.parseUrlParams();
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

    // Body input syntax highlighting and auto-beautify on paste
    const bodyInput = document.getElementById('body-input');
    bodyInput.addEventListener('input', () => {
      this.highlightBodyJSON();
    });
    bodyInput.addEventListener('paste', (e) => {
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
      bodyInput.textContent = finalText;
      
      // Apply syntax highlighting
      this.highlightBodyJSON();
    });


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

    // Save Request Modal
    const saveRequestModal = document.getElementById('save-request-modal');
    const requestNameInput = document.getElementById('request-name-input');
    const collectionSelect = document.getElementById('collection-select');
    const saveRequestConfirmBtn = document.getElementById('save-request-confirm');
    const cancelSaveRequestBtn = document.getElementById('cancel-save-request');
    const closeSaveModalBtn = document.getElementById('close-save-modal');
    const createNewCollectionOptionBtn = document.getElementById('create-new-collection-option');

    // Save request confirm button
    if (saveRequestConfirmBtn) {
      saveRequestConfirmBtn.addEventListener('click', () => {
        this.handleSaveRequest();
      });
    }

    // Cancel/Close save request modal
    [cancelSaveRequestBtn, closeSaveModalBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.hideSaveRequestModal();
        });
      }
    });

    // Create new collection option
    if (createNewCollectionOptionBtn) {
      createNewCollectionOptionBtn.addEventListener('click', () => {
        this.hideSaveRequestModal();
        this.showNewCollectionModal();
      });
    }

    // Close modal when clicking outside
    if (saveRequestModal) {
      saveRequestModal.addEventListener('click', (e) => {
        if (e.target === saveRequestModal) {
          this.hideSaveRequestModal();
        }
      });
    }


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
          e.target.id === 'body-input') {
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
    const method = document.getElementById('method-select').value;
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
      const body = document.getElementById('body-input').textContent.trim();

      // Build URL with params
      let requestUrl = url;
      const urlParams = new URLSearchParams(params);
      if (urlParams.toString()) {
        requestUrl += (url.includes('?') ? '&' : '?') + urlParams.toString();
      }

      // Prepare request options
      const requestOptions = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      // Add body for POST, PUT, PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        requestOptions.body = body;
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
        body,
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

    // Update headers count
    const headersCount = response.headers ? Object.keys(Object.fromEntries(response.headers.entries())).length : 0;
    const headersCountElement = document.getElementById('headers-count');
    if (headersCountElement) {
      headersCountElement.textContent = headersCount.toString();
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
    const headersCountElement = document.getElementById('headers-count');
    if (headersCountElement) {
      headersCountElement.textContent = '0';
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

    // Clear last response data since we're loading a stored request
    this.lastResponseData = null;
    
    // Clear collection tracking since this is from history
    this.currentCollectionId = null;
    this.currentCollectionRequestId = null;

    // Set method and URL - keep the full URL as stored
    document.getElementById('method-select').value = item.method;
    
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

    // Set body
    const bodyInput = document.getElementById('body-input');
    bodyInput.textContent = item.body || '';
    this.highlightBodyJSON();

    // Display previous response
    if (item.response) {
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
        this.handleDrag(e);
      }
    });

    document.addEventListener('mouseup', () => {
      this.endDrag();
    });
  }

  startDrag(handle, event) {
    this.isDragging = true;
    this.currentDragTarget = handle.getAttribute('data-target');
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    this.startX = event.clientX;
    const sidebar = document.getElementById(this.currentDragTarget);
    this.startWidth = sidebar.offsetWidth;
  }

  handleDrag(event) {
    if (!this.isDragging || !this.currentDragTarget) return;
    
    const sidebar = document.getElementById(this.currentDragTarget);
    const deltaX = event.clientX - this.startX;
    
    let newWidth;
    if (this.currentDragTarget === 'left-sidebar') {
      newWidth = this.startWidth + deltaX;
    } else {
      newWidth = this.startWidth - deltaX;
    }
    
    // Apply constraints
    newWidth = Math.max(200, Math.min(600, newWidth));
    
    sidebar.style.width = newWidth + 'px';
  }

  endDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Remove dragging class from all handles
    document.querySelectorAll('.drag-handle').forEach(handle => {
      handle.classList.remove('dragging');
    });
    
    // Save the new width
    if (this.currentDragTarget) {
      const sidebar = document.getElementById(this.currentDragTarget);
      const width = sidebar.offsetWidth;
      this.sidebarStates[this.currentDragTarget] = { 
        ...this.sidebarStates[this.currentDragTarget], 
        width: width 
      };
      this.saveSidebarStates();
    }
    
    this.currentDragTarget = null;
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
    const bodyInput = document.getElementById('body-input');
    const content = bodyInput.textContent.trim();
    
    if (!content) return;
    
    try {
      const parsed = JSON.parse(content);
      const beautified = JSON.stringify(parsed, null, 2);
      bodyInput.textContent = beautified;
      this.highlightBodyJSON();
    } catch (err) {
      // If it's not valid JSON, just format it nicely
      console.log('Not valid JSON, keeping as is');
    }
  }

  highlightBodyJSON() {
    const bodyInput = document.getElementById('body-input');
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
    const url = urlInput.value.trim();
    
    if (!url) return;
    
    try {
      const urlObj = new URL(url);
      
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
    
    // Update the request with current data
    const method = document.getElementById('method-select')?.value;
    const url = document.getElementById('url-input')?.value.trim();
    const headers = this.getKeyValuePairs('headers-container');
    const params = this.getKeyValuePairs('params-container');
    const body = document.getElementById('body-input')?.textContent.trim() || '';
    
    // Get auth data if available
    let authData = null;
    if (window.authManager) {
      authData = window.authManager.exportAuthData();
    }
    
    // Update the request object
    request.method = method;
    request.url = url;
    request.headers = headers;
    request.params = params;
    request.body = body;
    request.auth = authData;
    request.response = this.lastResponseData; // Update with latest response
    request.lastExecuted = new Date().toISOString(); // Track when it was last executed
    
    // Save the updated collections
    window.collectionsManager.saveCollections();
    
    // Show a subtle notification
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
    const bodyInput = document.getElementById('body-input');
    const bodyIndicator = document.getElementById('body-indicator');
    if (bodyInput && bodyIndicator) {
      const hasBody = bodyInput.textContent.trim().length > 0;
      bodyIndicator.style.display = hasBody ? 'inline-block' : 'none';
    }
  }

  createNewRequestTab() {
    // Clear the form for a new request
    document.getElementById('method-select').value = 'GET';
    document.getElementById('url-input').value = '';
    
    // Clear all key-value pairs
    this.setKeyValuePairs('params-container', {});
    this.setKeyValuePairs('headers-container', {});
    
    // Clear body
    const bodyInput = document.getElementById('body-input');
    if (bodyInput) {
      bodyInput.textContent = '';
    }
    
    // Clear auth
    if (window.authManager) {
      window.authManager.setAuthType('none');
    }
    
    // Clear collection tracking for new request
    this.currentCollectionId = null;
    this.currentCollectionRequestId = null;
    
    // Clear response
    const responseEmptyState = document.getElementById('response-empty-state');
    const jsonContainer = document.getElementById('json-container');
    if (responseEmptyState) responseEmptyState.style.display = 'block';
    if (jsonContainer) jsonContainer.style.display = 'none';
    
    // Hide response status bar
    const statusBar = document.getElementById('response-status-bar');
    if (statusBar) statusBar.style.display = 'none';
    
    // Clear response headers
    const headersTable = document.getElementById('response-headers-table');
    if (headersTable) headersTable.innerHTML = '';
    
    // Focus on URL input
    document.getElementById('url-input').focus();
    
    // Add console log
    this.addConsoleLog('New request tab created');
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
}

// Initialize function to avoid duplication
function initializeApp() {
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
