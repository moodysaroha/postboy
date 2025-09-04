// Collections Management Module
class CollectionsManager {
  constructor() {
    this.collections = JSON.parse(localStorage.getItem('api-collections') || '[]');
  }

  init() {
    this.renderCollections();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // New collection button
    const newCollectionBtn = document.getElementById('new-collection-btn');
    if (newCollectionBtn) {
      newCollectionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.createNewCollection();
      });
    }

    // Save request button
    const saveRequestBtn = document.getElementById('save-request-btn-main');
    if (saveRequestBtn) {
      saveRequestBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveCurrentRequest();
      });
    }

    this.setupModalEventListeners();
  }

  setupModalEventListeners() {
    // New Collection Modal
    const createCollectionBtn = document.getElementById('create-collection');
    const cancelCollectionBtn = document.getElementById('cancel-collection');
    const closeCollectionModalBtn = document.getElementById('close-collection-modal');

    if (createCollectionBtn) {
      createCollectionBtn.addEventListener('click', () => {
        this.handleCreateCollection();
      });
    }

    [cancelCollectionBtn, closeCollectionModalBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.hideNewCollectionModal();
        });
      }
    });

    // Enter key in collection name input
    const collectionNameInput = document.getElementById('collection-name-input');
    if (collectionNameInput) {
      collectionNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleCreateCollection();
        }
      });
    }

    // Save Request Modal
    const saveRequestConfirmBtn = document.getElementById('save-request-confirm');
    const cancelSaveRequestBtn = document.getElementById('cancel-save-request');
    const closeSaveModalBtn = document.getElementById('close-save-modal');

    if (saveRequestConfirmBtn) {
      saveRequestConfirmBtn.addEventListener('click', () => {
        this.handleSaveRequest();
      });
    }

    [cancelSaveRequestBtn, closeSaveModalBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.hideSaveRequestModal();
        });
      }
    });
  }

  createNewCollection() {
    this.showNewCollectionModal();
  }

  showNewCollectionModal() {
    const modal = document.getElementById('new-collection-modal');
    const input = document.getElementById('collection-name-input');
    
    if (input) input.value = '';
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => input?.focus(), 100);
    }
  }

  hideNewCollectionModal() {
    const modal = document.getElementById('new-collection-modal');
    if (modal) modal.style.display = 'none';
  }

  handleCreateCollection() {
    const input = document.getElementById('collection-name-input');
    const name = input?.value.trim();
    
    if (!name) {
      input?.focus();
      return;
    }

    const collection = {
      id: Date.now().toString(),
      name: name,
      requests: [],
      expanded: true,
      created: new Date().toISOString()
    };

    this.collections.unshift(collection);
    this.saveCollections();
    this.renderCollections();
    this.hideNewCollectionModal();
  }

  saveCurrentRequest() {
    const method = document.getElementById('method-select')?.value;
    const url = document.getElementById('url-input')?.value.trim();
    
    if (!url) {
      alert('Please enter a URL first');
      return;
    }

    this.showSaveRequestModal(method, url);
  }

  showSaveRequestModal(method, url) {
    const modal = document.getElementById('save-request-modal');
    const requestNameInput = document.getElementById('request-name-input');
    const collectionSelect = document.getElementById('collection-select');
    
    // Set default request name
    if (requestNameInput) {
      requestNameInput.value = `${method} ${url.split('/').pop() || 'Request'}`;
    }
    
    // Populate collection select
    if (collectionSelect) {
      collectionSelect.innerHTML = '<option value="">Select a collection...</option>';
      
      if (this.collections.length === 0) {
        collectionSelect.innerHTML = '<option value="">No collections available</option>';
        collectionSelect.disabled = true;
      } else {
        collectionSelect.disabled = false;
        this.collections.forEach((collection, index) => {
          const option = document.createElement('option');
          option.value = index;
          option.textContent = collection.name;
          collectionSelect.appendChild(option);
        });
      }
    }
    
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => requestNameInput?.focus(), 100);
    }
  }

  hideSaveRequestModal() {
    const modal = document.getElementById('save-request-modal');
    if (modal) modal.style.display = 'none';
  }

  handleSaveRequest() {
    const requestNameInput = document.getElementById('request-name-input');
    const collectionSelect = document.getElementById('collection-select');
    
    const requestName = requestNameInput?.value.trim();
    const collectionIndex = parseInt(collectionSelect?.value);
    
    if (!requestName) {
      alert('Please enter a request name');
      requestNameInput?.focus();
      return;
    }
    
    if (isNaN(collectionIndex) || collectionIndex < 0 || collectionIndex >= this.collections.length) {
      alert('Please select a collection');
      collectionSelect?.focus();
      return;
    }

    // Get current request data
    const method = document.getElementById('method-select')?.value;
    const url = document.getElementById('url-input')?.value.trim();
    
    // Get headers, params, and body
    let headers = {};
    let params = {};
    let body = '';
    
    if (window.postboy) {
      headers = window.postboy.getKeyValuePairs('headers-container');
      params = window.postboy.getKeyValuePairs('params-container');
      body = document.getElementById('body-input')?.textContent.trim() || '';
    }
    
    // Get auth data if auth manager exists
    let authData = null;
    if (window.authManager) {
      authData = window.authManager.exportAuthData();
    }

    // Use the last response data from sendRequest
    let responseData = null;
    if (window.postboy) {
      responseData = window.postboy.lastResponseData;
    }

    const request = {
      id: Date.now().toString(),
      name: requestName,
      method,
      url,
      headers,
      params,
      body,
      auth: authData,
      response: responseData, // Store response data if available
      created: new Date().toISOString()
    };

    this.collections[collectionIndex].requests.push(request);
    this.saveCollections();
    this.renderCollections();
    this.hideSaveRequestModal();
    
    // Log success
    if (window.postboy && window.postboy.addConsoleLog) {
      window.postboy.addConsoleLog(`Request saved to "${this.collections[collectionIndex].name}" collection`);
    }
  }

  renderCollections() {
    const collectionsList = document.getElementById('collections-list');
    if (!collectionsList) return;
    
    if (this.collections.length === 0) {
      collectionsList.innerHTML = `
        <div class="empty-collections">
          <p>No collections yet</p>
          <p>Click "+" to create your first collection</p>
        </div>
      `;
      return;
    }

    collectionsList.innerHTML = this.collections.map(collection => {
      const requestsHtml = collection.requests.map(request => `
        <div class="collection-request" data-request-id="${request.id}" data-collection-id="${collection.id}">
          <div class="method ${request.method.toLowerCase()}">${request.method}</div>
          <div class="name">${request.name}</div>
          <div class="request-actions">
            <button class="request-action-btn delete-request-btn" data-request-id="${request.id}" data-collection-id="${collection.id}" title="Delete Request">🗑️</button>
          </div>
        </div>
      `).join('');

      return `
        <div class="collection-item ${collection.expanded ? 'expanded' : ''}" data-collection-id="${collection.id}">
          <div class="collection-header">
            <div class="collection-name">
              <span class="collection-toggle">▶</span>
              <span class="collection-name-text" data-collection-id="${collection.id}">${collection.name}</span>
              <input class="collection-name-input" data-collection-id="${collection.id}" value="${collection.name}" style="display: none;" />
            </div>
            <div class="collection-actions">
              <button class="collection-action-btn rename-collection-btn" data-collection-id="${collection.id}" title="Rename">✏️</button>
              <button class="collection-action-btn" onclick="window.collectionsManager.deleteCollection('${collection.id}')" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="collection-requests">
            ${requestsHtml}
          </div>
        </div>
      `;
    }).join('');

    this.setupCollectionEventListeners();
  }

  setupCollectionEventListeners() {
    // Collection toggle
    document.querySelectorAll('.collection-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.classList.contains('collection-action-btn')) return;
        if (e.target.classList.contains('collection-name-input')) return;
        
        const collectionItem = header.closest('.collection-item');
        const collectionId = collectionItem.getAttribute('data-collection-id');
        this.toggleCollection(collectionId);
      });
    });

    // Request click
    document.querySelectorAll('.collection-request').forEach(request => {
      request.addEventListener('click', (e) => {
        // Don't load request if clicking on action buttons
        if (e.target.classList.contains('request-action-btn')) return;
        
        const requestId = request.getAttribute('data-request-id');
        const collectionId = request.getAttribute('data-collection-id');
        this.loadCollectionRequest(collectionId, requestId);
      });
    });

    // Request delete buttons
    document.querySelectorAll('.delete-request-btn').forEach(deleteBtn => {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the request click
        
        const requestId = deleteBtn.getAttribute('data-request-id');
        const collectionId = deleteBtn.getAttribute('data-collection-id');
        this.deleteCollectionRequest(collectionId, requestId);
      });
    });

    // Rename collection buttons
    document.querySelectorAll('.rename-collection-btn').forEach(renameBtn => {
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the header click
        
        const collectionId = renameBtn.getAttribute('data-collection-id');
        this.startRenameCollection(collectionId);
      });
    });

    // Collection name inputs (for inline editing)
    document.querySelectorAll('.collection-name-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.finishRenameCollection(input.getAttribute('data-collection-id'), input.value);
        } else if (e.key === 'Escape') {
          this.cancelRenameCollection(input.getAttribute('data-collection-id'));
        }
      });

      input.addEventListener('blur', (e) => {
        this.finishRenameCollection(input.getAttribute('data-collection-id'), input.value);
      });
    });
  }

  toggleCollection(collectionId) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (!collection) return;

    collection.expanded = !collection.expanded;
    this.saveCollections();
    this.renderCollections();
  }

  loadCollectionRequest(collectionId, requestId) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const request = collection.requests.find(r => r.id === requestId);
    if (!request) return;

    // Clear last response data since we're loading a stored request
    if (window.postboy) {
      window.postboy.lastResponseData = null;
      // Track that this request is from a collection for auto-save
      window.postboy.currentCollectionId = collectionId;
      window.postboy.currentCollectionRequestId = requestId;
    }

    // Load request data into form
    const methodSelect = document.getElementById('method-select');
    const urlInput = document.getElementById('url-input');
    
    if (methodSelect) methodSelect.value = request.method;
    
    // Parse URL to separate base URL and query params
    try {
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
      if (urlInput) urlInput.value = baseUrl;
      
      // Extract URL params
      const urlParams = {};
      url.searchParams.forEach((value, key) => {
        urlParams[key] = value;
      });
      
      // Merge URL params with stored params
      const allParams = { ...urlParams, ...(request.params || {}) };
      if (window.postboy) {
        window.postboy.setKeyValuePairs('params-container', allParams);
      }
    } catch (err) {
      // If URL parsing fails, use as-is
      if (urlInput) urlInput.value = request.url;
      if (window.postboy && request.params) {
        window.postboy.setKeyValuePairs('params-container', request.params);
      }
    }
    
    if (window.postboy && request.headers) {
      window.postboy.setKeyValuePairs('headers-container', request.headers);
    }
    
    const bodyInput = document.getElementById('body-input');
    if (bodyInput) {
      bodyInput.textContent = request.body || '';
      if (window.postboy) {
        window.postboy.highlightBodyJSON();
      }
    }

    // Display stored response if available
    if (request.response && window.postboy) {
      window.postboy.displayResponse({
        status: request.response.status,
        statusText: request.response.statusText,
        ok: request.response.status < 400,
        headers: new Map(Object.entries(request.response.headers || {}))
      }, request.response.data, request.response.responseTime, request.created);
    }

    // Load auth data if available
    if (request.auth && window.authManager) {
      window.authManager.setAuthData(request.auth.type, request.auth.data);
    }
  }

  startRenameCollection(collectionId) {
    const nameText = document.querySelector(`.collection-name-text[data-collection-id="${collectionId}"]`);
    const nameInput = document.querySelector(`.collection-name-input[data-collection-id="${collectionId}"]`);
    
    if (!nameText || !nameInput) return;

    // Hide text, show input
    nameText.style.display = 'none';
    nameInput.style.display = 'inline-block';
    nameInput.focus();
    nameInput.select();
  }

  finishRenameCollection(collectionId, newName) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const nameText = document.querySelector(`.collection-name-text[data-collection-id="${collectionId}"]`);
    const nameInput = document.querySelector(`.collection-name-input[data-collection-id="${collectionId}"]`);
    
    if (!nameText || !nameInput) return;

    // Validate name
    const trimmedName = newName.trim();
    if (trimmedName && trimmedName !== collection.name) {
      collection.name = trimmedName;
      this.saveCollections();
      this.renderCollections();
      if (window.postboy) {
        window.postboy.addConsoleLog(`Collection renamed to "${trimmedName}"`);
      }
    } else {
      // Hide input, show text
      nameInput.style.display = 'none';
      nameText.style.display = 'inline-block';
    }
  }

  cancelRenameCollection(collectionId) {
    const nameText = document.querySelector(`.collection-name-text[data-collection-id="${collectionId}"]`);
    const nameInput = document.querySelector(`.collection-name-input[data-collection-id="${collectionId}"]`);
    
    if (!nameText || !nameInput) return;

    // Reset input value and hide it
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection) {
      nameInput.value = collection.name;
    }
    
    nameInput.style.display = 'none';
    nameText.style.display = 'inline-block';
  }

  deleteCollectionRequest(collectionId, requestId) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const request = collection.requests.find(r => r.id === requestId);
    if (!request) return;

    // Use confirm dialog for delete confirmation
    const confirmDelete = window.confirm(`Delete request "${request.name}"?`);
    if (!confirmDelete) return;

    // Remove the request from the collection
    collection.requests = collection.requests.filter(r => r.id !== requestId);
    
    this.saveCollections();
    this.renderCollections();
    
    // Add to console
    if (window.postboy) {
      window.postboy.addConsoleLog(`Request "${request.name}" deleted from collection "${collection.name}"`);
    }
  }

  deleteCollection(collectionId) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const confirmDelete = window.confirm(`Delete collection "${collection.name}"? This will also delete all ${collection.requests.length} requests in this collection.`);
    if (!confirmDelete) return;

    this.collections = this.collections.filter(c => c.id !== collectionId);
    this.saveCollections();
    this.renderCollections();
  }

  saveCollections() {
    localStorage.setItem('api-collections', JSON.stringify(this.collections));
  }
}

// Export for use in other modules
window.CollectionsManager = CollectionsManager;
