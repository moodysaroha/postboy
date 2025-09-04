// Authentication Module
class AuthManager {
  constructor() {
    this.currentAuthType = 'none';
    this.authData = {};
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Auth type change listener
    const authTypeSelect = document.getElementById('auth-type');
    if (authTypeSelect) {
      authTypeSelect.addEventListener('change', (e) => {
        this.updateAuthContent(e.target.value);
        this.currentAuthType = e.target.value;
      });
    }
  }

  updateAuthContent(authType) {
    const authContent = document.getElementById('auth-content');
    if (!authContent) return;
    
    switch (authType) {
      case 'basic':
        authContent.innerHTML = `
          <div class="auth-fields">
            <div class="auth-field">
              <label for="auth-username">Username:</label>
              <input type="text" id="auth-username" placeholder="Enter username" />
            </div>
            <div class="auth-field">
              <label for="auth-password">Password:</label>
              <input type="password" id="auth-password" placeholder="Enter password" />
            </div>
          </div>
        `;
        break;
      case 'bearer':
        authContent.innerHTML = `
          <div class="auth-fields">
            <div class="auth-field">
              <label for="auth-token">Token:</label>
              <input type="text" id="auth-token" placeholder="Enter bearer token" />
            </div>
          </div>
        `;
        break;
      case 'api-key':
        authContent.innerHTML = `
          <div class="auth-fields">
            <div class="auth-field">
              <label for="auth-key">Key:</label>
              <input type="text" id="auth-key" placeholder="Enter API key name" />
            </div>
            <div class="auth-field">
              <label for="auth-value">Value:</label>
              <input type="text" id="auth-value" placeholder="Enter API key value" />
            </div>
            <div class="auth-field">
              <label for="auth-location">Add to:</label>
              <select id="auth-location" class="auth-type-select">
                <option value="header">Header</option>
                <option value="query">Query Params</option>
              </select>
            </div>
          </div>
        `;
        break;
      default:
        authContent.innerHTML = '<div class="empty-state">This request does not use any authorization.</div>';
        break;
    }

    // Setup input listeners for the new fields
    this.setupAuthFieldListeners();
  }

  setupAuthFieldListeners() {
    // Listen for changes in auth fields to store data
    const authFields = document.querySelectorAll('#auth-content input, #auth-content select');
    authFields.forEach(field => {
      field.addEventListener('input', () => {
        this.collectAuthData();
      });
    });
  }

  collectAuthData() {
    this.authData = {};
    
    switch (this.currentAuthType) {
      case 'basic':
        this.authData = {
          username: document.getElementById('auth-username')?.value || '',
          password: document.getElementById('auth-password')?.value || ''
        };
        break;
      case 'bearer':
        this.authData = {
          token: document.getElementById('auth-token')?.value || ''
        };
        break;
      case 'api-key':
        this.authData = {
          key: document.getElementById('auth-key')?.value || '',
          value: document.getElementById('auth-value')?.value || '',
          location: document.getElementById('auth-location')?.value || 'header'
        };
        break;
    }
  }

  getAuthHeaders() {
    const headers = {};
    
    switch (this.currentAuthType) {
      case 'basic':
        if (this.authData.username || this.authData.password) {
          const credentials = btoa(`${this.authData.username}:${this.authData.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      case 'bearer':
        if (this.authData.token) {
          headers['Authorization'] = `Bearer ${this.authData.token}`;
        }
        break;
      case 'api-key':
        if (this.authData.key && this.authData.value && this.authData.location === 'header') {
          headers[this.authData.key] = this.authData.value;
        }
        break;
    }
    
    return headers;
  }

  getAuthParams() {
    const params = {};
    
    if (this.currentAuthType === 'api-key' && 
        this.authData.key && 
        this.authData.value && 
        this.authData.location === 'query') {
      params[this.authData.key] = this.authData.value;
    }
    
    return params;
  }

  setAuthData(authType, data) {
    this.currentAuthType = authType;
    this.authData = data || {};
    
    // Update UI
    const authTypeSelect = document.getElementById('auth-type');
    if (authTypeSelect) {
      authTypeSelect.value = authType;
    }
    
    this.updateAuthContent(authType);
    
    // Populate fields
    setTimeout(() => {
      this.populateAuthFields();
    }, 100);
  }

  populateAuthFields() {
    switch (this.currentAuthType) {
      case 'basic':
        const usernameField = document.getElementById('auth-username');
        const passwordField = document.getElementById('auth-password');
        if (usernameField) usernameField.value = this.authData.username || '';
        if (passwordField) passwordField.value = this.authData.password || '';
        break;
      case 'bearer':
        const tokenField = document.getElementById('auth-token');
        if (tokenField) tokenField.value = this.authData.token || '';
        break;
      case 'api-key':
        const keyField = document.getElementById('auth-key');
        const valueField = document.getElementById('auth-value');
        const locationField = document.getElementById('auth-location');
        if (keyField) keyField.value = this.authData.key || '';
        if (valueField) valueField.value = this.authData.value || '';
        if (locationField) locationField.value = this.authData.location || 'header';
        break;
    }
    
    this.setupAuthFieldListeners();
  }

  exportAuthData() {
    return {
      type: this.currentAuthType,
      data: { ...this.authData }
    };
  }
}

// Export for use in other modules
window.AuthManager = AuthManager;
