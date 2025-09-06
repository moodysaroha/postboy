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

    this.setupModalEventListeners();
  }

  setupModalEventListeners() {
    // No HTML modal event listeners needed - using modal-manager now
  }

  async createNewCollection() {
    const modalContent = `
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Collection Name:</label>
        <input type="text" id="new-collection-name" placeholder="Enter collection name..." 
               style="width: 100%; padding: 8px; border: 1px solid #444; border-radius: 4px; background: #2b2d31; color: #f2f3f5;">
      </div>
    `;

    const result = await window.modalManager.showModal({
      title: 'Create New Collection',
      message: modalContent,
      buttons: ['Create', 'Cancel'],
      defaultButton: 0,
      cancelable: true
    });
    
    if (result.response === 0) {
      const name = document.getElementById('new-collection-name')?.value.trim();
      if (name) {
        this.handleCreateCollection(name);
      } else {
        await window.modalManager.showWarning('Collection Name Required', 'Please enter a collection name');
        return this.createNewCollection();
      }
    }
  }

  handleCreateCollection(name) {
    if (!name) {
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
    
    // Switch to Collections tab after creating a new collection
    if (window.postboy && window.postboy.switchSidebarTab) {
      window.postboy.switchSidebarTab('collections');
    }
  }

  async saveCurrentRequest() {
    const method = window.postboy.getMethodValue();
    const url = document.getElementById('url-input')?.value.trim();
    
    if (!url) {
      await window.modalManager.showWarning('URL Required', 'Please enter a URL first');
      return;
    }

    this.showSaveRequestModal(method, url);
  }

  async showSaveRequestModal(method, url) {
    const defaultName = url.split('/').pop() || 'Request';
    
    if (this.collections.length === 0) {
      const createFirst = await window.modalManager.confirm(
        'No Collections',
        'You need to create a collection first.',
        'Would you like to create one now?'
      );
      
      if (createFirst) {
        await this.createNewCollection();
      }
      return;
    }

    const collectionOptions = this.collections.map((collection, index) => 
      `<option value="${index}">${collection.name}</option>`
    ).join('');

    const modalContent = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Request Name:</label>
          <input type="text" id="save-request-name" value="${defaultName}" 
                 style="width: 100%; padding: 8px; border: 1px solid #444; border-radius: 4px; background: #2b2d31; color: #f2f3f5;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Collection:</label>
          <select id="save-collection-select" 
                  style="width: 100%; padding: 8px; border: 1px solid #444; border-radius: 4px; background: #2b2d31; color: #f2f3f5;">
            <option value="">Select a collection...</option>
            ${collectionOptions}
          </select>
        </div>
        <div>
          <button id="create-new-collection-btn" 
                  style="background: none; border: none; color: #00a8fc; text-decoration: underline; cursor: pointer;">
            + Create New Collection
          </button>
        </div>
      </div>
    `;

    const modalPromise = window.modalManager.showModal({
      title: 'Save Request',
      message: modalContent,
      buttons: ['Save', 'Cancel'],
      defaultButton: 0,
      cancelable: true
    });

    // Add event listener for the create new collection button after modal is shown
    setTimeout(() => {
      const createBtn = document.getElementById('create-new-collection-btn');
      if (createBtn) {
        createBtn.addEventListener('click', async () => {
          // Close the current modal first
          const activeModal = document.querySelector('.discord-modal');
          if (activeModal) {
            activeModal.remove();
          }
          
          // Create new collection
          await this.createNewCollection();
          
          // Restart the save request process
          this.showSaveRequestModal(method, url);
        });
      }
    }, 100);

    const result = await modalPromise;

    if (result.response === 0) {
      const requestName = document.getElementById('save-request-name')?.value.trim();
      const collectionIndex = parseInt(document.getElementById('save-collection-select')?.value);
      
      if (!requestName) {
        await window.modalManager.showWarning('Request Name Required', 'Please enter a request name');
        return this.showSaveRequestModal(method, url);
      }
      
      if (isNaN(collectionIndex)) {
        await window.modalManager.showWarning('Collection Required', 'Please select a collection');
        return this.showSaveRequestModal(method, url);
      }

      this.handleSaveRequest(requestName, collectionIndex);
    }
  }

  handleSaveRequest(requestName, collectionIndex) {
    if (!requestName) {
      return;
    }
    
    if (isNaN(collectionIndex) || collectionIndex < 0 || collectionIndex >= this.collections.length) {
      return;
    }

    const method = window.postboy.getMethodValue();
    const baseUrl = document.getElementById('url-input')?.value.trim();
    
    let headers = {};
    let params = {};
    let body = '';
    
    let bodyType = 'none';
    
    if (window.postboy) {
      headers = window.postboy.getKeyValuePairs('headers-container');
      params = window.postboy.getKeyValuePairs('params-container');
      
      // Get body and body type from the current selection
      const bodyData = window.postboy.getRequestBody();
      body = bodyData.body || '';
      bodyType = window.postboy.getCurrentBodyType();
    }
    
    let fullUrl = baseUrl;
    const urlParams = new URLSearchParams(params);
    if (urlParams.toString()) {
      fullUrl += (baseUrl.includes('?') ? '&' : '?') + urlParams.toString();
    }
    
    let authData = null;
    if (window.authManager) {
      authData = window.authManager.exportAuthData();
    }

    let responseData = null;
    if (window.postboy) {
      responseData = window.postboy.lastResponseData;
    }

    const request = {
      id: Date.now().toString(),
      name: requestName,
      method,
      url: fullUrl,
      headers,
      params,
      body,
      bodyType,
      auth: authData,
      response: responseData,
      created: new Date().toISOString()
    };

    this.collections[collectionIndex].requests.push(request);
    this.saveCollections();
    this.renderCollections();
    
    // Switch to Collections tab after saving
    if (window.postboy && window.postboy.switchSidebarTab) {
      window.postboy.switchSidebarTab('collections');
    }
    
    // Mark current tab as saved
    if (window.postboy && window.postboy.markTabAsSaved) {
      window.postboy.markTabAsSaved(null, requestName);
    }
    
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
          <div class="name">
            <span class="request-name-text" data-request-id="${request.id}" data-collection-id="${collection.id}">${request.name}</span>
            <input class="request-name-input" data-request-id="${request.id}" data-collection-id="${collection.id}" value="${request.name}" style="display: none;" />
          </div>
          <div class="request-actions">
            <button class="request-action-btn rename-request-btn" data-request-id="${request.id}" data-collection-id="${collection.id}" title="Rename Request">✏️</button>
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

    // Rename request buttons
    document.querySelectorAll('.rename-request-btn').forEach(renameBtn => {
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the request click
        
        const requestId = renameBtn.getAttribute('data-request-id');
        const collectionId = renameBtn.getAttribute('data-collection-id');
        this.startRenameRequest(collectionId, requestId);
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

    // Request name inputs (for inline editing)
    document.querySelectorAll('.request-name-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const collectionId = input.getAttribute('data-collection-id');
          const requestId = input.getAttribute('data-request-id');
          this.finishRenameRequest(collectionId, requestId, input.value);
        } else if (e.key === 'Escape') {
          const collectionId = input.getAttribute('data-collection-id');
          const requestId = input.getAttribute('data-request-id');
          this.cancelRenameRequest(collectionId, requestId);
        }
      });

      input.addEventListener('blur', (e) => {
        const collectionId = input.getAttribute('data-collection-id');
        const requestId = input.getAttribute('data-request-id');
        this.finishRenameRequest(collectionId, requestId, input.value);
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

    if (!window.postboy) return;

    // Track that this request is from a collection for auto-save
    window.postboy.currentCollectionId = collectionId;
    window.postboy.currentCollectionRequestId = requestId;

    // Set method and URL - keep the full URL as stored
    window.postboy.setMethodValue(request.method);
    
    // Parse URL to separate base URL and query params
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
    
    document.getElementById('url-input').value = baseUrl;

    // Set headers
    window.postboy.setKeyValuePairs('headers-container', request.headers || {});

    // Extract and set params from URL
    const urlParams = {};
    url.searchParams.forEach((value, key) => {
      urlParams[key] = value;
    });
    
    // Merge URL params with stored params (stored params take precedence)
    const allParams = { ...urlParams, ...(request.params || {}) };
    window.postboy.setKeyValuePairs('params-container', allParams);

    // Set body type and content
    const bodyType = request.bodyType || (request.body ? 'json' : 'none'); // Fallback for old requests
    window.postboy.setBodyType(bodyType);
    
    if (request.body && bodyType !== 'none') {
      if (bodyType === 'form-urlencoded') {
        // Handle form URL encoded data
        window.postboy.setFormUrlEncodedData(request.body);
      } else if (bodyType === 'form-data') {
        // Handle form data (would need more complex restoration)
        console.warn('Form data restoration not fully implemented');
      } else {
        // Handle text-based body types (json, xml, yaml, etc.) with auto-formatting
        window.postboy.setBodyContentWithFormatting(bodyType, request.body);
      }
    }
    window.postboy.updateTabIndicators();

    // Load auth data if available
    if (request.auth && window.authManager) {
      window.authManager.setAuthData(request.auth.type, request.auth.data);
    }

    if (request.response) {
      window.postboy.displayResponse({
        status: request.response.status,
        statusText: request.response.statusText,
        ok: request.response.status < 400,
        headers: new Map(Object.entries(request.response.headers || {}))
      }, request.response.data, request.response.responseTime, request.created);
    }
    
    // Mark current tab as saved with the request name
    if (window.postboy && window.postboy.markTabAsSaved) {
      window.postboy.markTabAsSaved(null, request.name);
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

  startRenameRequest(collectionId, requestId) {
    const nameText = document.querySelector(`.request-name-text[data-request-id="${requestId}"][data-collection-id="${collectionId}"]`);
    const nameInput = document.querySelector(`.request-name-input[data-request-id="${requestId}"][data-collection-id="${collectionId}"]`);
    
    if (!nameText || !nameInput) return;

    // Hide text, show input
    nameText.style.display = 'none';
    nameInput.style.display = 'inline-block';
    nameInput.focus();
    nameInput.select();
  }

  finishRenameRequest(collectionId, requestId, newName) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const request = collection.requests.find(r => r.id === requestId);
    if (!request) return;

    const nameText = document.querySelector(`.request-name-text[data-request-id="${requestId}"][data-collection-id="${collectionId}"]`);
    const nameInput = document.querySelector(`.request-name-input[data-request-id="${requestId}"][data-collection-id="${collectionId}"]`);
    
    if (!nameText || !nameInput) return;

    // Validate name
    const trimmedName = newName.trim();
    if (trimmedName && trimmedName !== request.name) {
      request.name = trimmedName;
      this.saveCollections();
      this.renderCollections();
      if (window.postboy) {
        window.postboy.addConsoleLog(`Request renamed to "${trimmedName}"`);
      }
    } else {
      // Hide input, show text
      nameInput.style.display = 'none';
      nameText.style.display = 'inline-block';
    }
  }

  cancelRenameRequest(collectionId, requestId) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const request = collection.requests.find(r => r.id === requestId);
    if (!request) return;

    const nameText = document.querySelector(`.request-name-text[data-request-id="${requestId}"][data-collection-id="${collectionId}"]`);
    const nameInput = document.querySelector(`.request-name-input[data-request-id="${requestId}"][data-collection-id="${collectionId}"]`);
    
    if (!nameText || !nameInput) return;

    // Reset input value and hide it
    nameInput.value = request.name;
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

