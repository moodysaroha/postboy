// Modal Manager for Discord-style modals
class ModalManager {
  constructor() {
    this.activeModals = [];
    this.init();
  }

  init() {
    // Create modal container if it doesn't exist
    if (!document.getElementById('modal-container')) {
      const container = document.createElement('div');
      container.id = 'modal-container';
      document.body.appendChild(container);
    }

    // Listen for Escape key to close topmost modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModals.length > 0) {
        const topModal = this.activeModals[this.activeModals.length - 1];
        if (topModal.options.cancelable !== false) {
          this.closeModal(topModal.id);
        }
      }
    });
  }

  showModal(options) {
    const modalId = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Default options
    const defaultOptions = {
      type: 'info', // info, warning, error, success, question
      title: 'Notification',
      message: '',
      detail: '',
      buttons: ['OK'],
      defaultButton: 0,
      cancelable: true,
      width: 440,
      animated: true
    };

    const modalOptions = { ...defaultOptions, ...options };

    // Create modal HTML
    const modalHtml = this.createModalHtml(modalId, modalOptions);
    
    // Add to container
    const container = document.getElementById('modal-container');
    container.insertAdjacentHTML('beforeend', modalHtml);

    // Get modal element
    const modalElement = document.getElementById(modalId);

    // Store modal reference
    const modalRef = {
      id: modalId,
      element: modalElement,
      options: modalOptions,
      promise: null
    };

    // Create promise for button clicks
    modalRef.promise = new Promise((resolve) => {
      // Setup button click handlers
      const buttons = modalElement.querySelectorAll('.modal-btn');
      buttons.forEach((button, index) => {
        button.addEventListener('click', () => {
          resolve({ response: index, button: modalOptions.buttons[index] });
          this.closeModal(modalId);
        });

        // Set focus on default button
        if (index === modalOptions.defaultButton) {
          setTimeout(() => button.focus(), 100);
        }
      });

      // Close button handler
      const closeBtn = modalElement.querySelector('.modal-close-btn');
      if (closeBtn && modalOptions.cancelable) {
        closeBtn.addEventListener('click', () => {
          resolve({ response: -1, button: null });
          this.closeModal(modalId);
        });
      }

      // Click outside to close
      if (modalOptions.cancelable) {
        modalElement.addEventListener('click', (e) => {
          if (e.target === modalElement) {
            resolve({ response: -1, button: null });
            this.closeModal(modalId);
          }
        });
      }
    });

    this.activeModals.push(modalRef);

    // Show modal with animation
    requestAnimationFrame(() => {
      modalElement.classList.add('modal-visible');
    });

    return modalRef.promise;
  }

  createModalHtml(modalId, options) {
    const iconMap = {
      info: '📘',
      warning: '⚠️',
      error: '❌',
      success: '✅',
      question: '❓'
    };

    const icon = iconMap[options.type] || '📘';
    const closeButton = options.cancelable ? 
      `<button class="modal-close-btn" aria-label="Close">&times;</button>` : '';

    const buttonsHtml = options.buttons.map((buttonText, index) => {
      const isPrimary = index === options.defaultButton;
      const buttonClass = isPrimary ? 'modal-btn create-btn' : 'modal-btn cancel-btn';
      const isDestructive = buttonText.toLowerCase().includes('delete') || 
                           buttonText.toLowerCase().includes('remove');
      const destructiveClass = isDestructive ? ' destructive' : '';
      return `<button class="${buttonClass}${destructiveClass}">${buttonText}</button>`;
    }).join('');

    const detailHtml = options.detail ? 
      `<div class="modal-detail">${options.detail}</div>` : '';

    return `
      <div id="${modalId}" class="discord-modal">
        <div class="modal-dialog" style="width: ${options.width}px;">
          <div class="modal-content">
            ${closeButton}
            <div class="modal-icon">${icon}</div>
            <div class="modal-header">
              <h2 class="modal-title">${options.title}</h2>
            </div>
            <div class="modal-body">
              <div class="modal-message">${options.message}</div>
              ${detailHtml}
            </div>
            <div class="modal-footer">
              ${buttonsHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  closeModal(modalId) {
    const modalIndex = this.activeModals.findIndex(m => m.id === modalId);
    if (modalIndex === -1) return;

    const modal = this.activeModals[modalIndex];
    const modalElement = modal.element;

    // Remove with animation
    modalElement.classList.remove('modal-visible');
    modalElement.classList.add('modal-closing');

    setTimeout(() => {
      modalElement.remove();
      this.activeModals.splice(modalIndex, 1);
    }, 200);
  }

  // Convenience methods for common modal types
  async showInfo(title, message, detail = '') {
    return this.showModal({
      type: 'info',
      title,
      message,
      detail,
      buttons: ['OK']
    });
  }

  async showError(title, message, detail = '') {
    return this.showModal({
      type: 'error',
      title,
      message,
      detail,
      buttons: ['OK']
    });
  }

  async showWarning(title, message, detail = '') {
    return this.showModal({
      type: 'warning',
      title,
      message,
      detail,
      buttons: ['OK']
    });
  }

  async showSuccess(title, message, detail = '') {
    return this.showModal({
      type: 'success',
      title,
      message,
      detail,
      buttons: ['OK']
    });
  }

  async confirm(title, message, detail = '') {
    const result = await this.showModal({
      type: 'question',
      title,
      message,
      detail,
      buttons: ['Cancel', 'Confirm'],
      defaultButton: 1
    });
    return result.response === 1;
  }

  // Method for showing update-specific modals
  async showUpdateModal(updateInfo) {
    const { type, data } = updateInfo;
    console.log('Showing update modal:', type, data);

    switch (type) {
      case 'checking':
        // Don't show a blocking modal for checking status
        // Just log it - the user will be notified when check is complete
        console.log('Checking for updates...');
        return null;

      case 'available':
        return this.showModal({
          type: 'success',
          title: 'Update Available',
          message: `A new version (${data.version}) of PostBoy is available.`,
          detail: 'Would you like to download it now?',
          buttons: ['Later', 'Download Now'],
          defaultButton: 1
        });

      case 'not-available':
        return this.showInfo(
          'No Updates Available',
          'PostBoy is up to date!',
          `You are running the latest version (${data.version}).`
        );

      case 'downloaded':
        return this.showModal({
          type: 'success',
          title: 'Update Ready',
          message: `Version ${data.version} has been downloaded.`,
          detail: 'The update will be applied when you restart the application. Would you like to restart now?',
          buttons: ['Later', 'Restart Now'],
          defaultButton: 1
        });

      case 'error':
        return this.showError(
          'Update Error',
          'An error occurred while checking for updates.',
          data.message
        );

      case 'timeout':
        return this.showWarning(
          'Update Check Timeout',
          'Update check is taking longer than expected.',
          'The update server may be unreachable. Please check your internet connection and try again later.'
        );

      case 'dev-mode':
        return this.showInfo(
          'Development Mode',
          'Updates are not available in development mode.'
        );

      default:
        return null;
    }
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModalManager;
}
