// Global variables
let currentHighlightedElement = null;
let isActive = false;

// Function to enable element selection
function enableElementSelector() {
  isActive = true;
  document.body.style.cursor = 'crosshair';
  
  // Create and show notification
  showNotification("Hover over an element and click to capture it");
  
  // Add mouseover event listener to the document
  document.addEventListener('mouseover', handleMouseOver);
  
  // Add click event listener to the document
  document.addEventListener('click', handleElementClick);
}

// Function to show a temporary notification
function showNotification(message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '10px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
  notification.style.color = 'white';
  notification.style.padding = '8px 16px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '10000';
  notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
  notification.style.fontSize = '14px';
  notification.id = 'element-capture-notification';
  
  // Add to body
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    const notificationElement = document.getElementById('element-capture-notification');
    if (notificationElement) {
      notificationElement.remove();
    }
  }, 3000);
}

// Function to handle mouseover events
function handleMouseOver(event) {
  if (!isActive) return;
  
  // Prevent event from reaching the elements beneath
  event.stopPropagation();
  
  // Remove highlight from previous element
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove('element-selector-highlight');
  }
  
  // Set current element and add highlight
  currentHighlightedElement = event.target;
  currentHighlightedElement.classList.add('element-selector-highlight');
}

// Function to handle element click
function handleElementClick(event) {
  if (!isActive) return;
  
  // Prevent default behavior and propagation
  event.preventDefault();
  event.stopPropagation();
  
  // Remove all event listeners
  disableElementSelector();
  
  // Mark the selected element
  currentHighlightedElement.classList.remove('element-selector-highlight');
  currentHighlightedElement.classList.add('element-selector-selected');
  
  // Calculate element's bounding rect
  const rect = currentHighlightedElement.getBoundingClientRect();
  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'captureElement',
    data: {
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      // Including scroll position for accurate capture
      scrollX: window.scrollX,
      scrollY: window.scrollY
    }
  }, (response) => {
    // Check for runtime errors (connection issues)
    if (chrome.runtime.lastError) {
      console.error('Error communicating with background script:', chrome.runtime.lastError);
      showNotification("Error capturing screenshot. Please try again.");
      cleanupSelection();
      return;
    }
    
    if (response && response.imageDataUrl) {
      cropAndDownloadImage(response.imageDataUrl, rect);
    } else {
      console.error('Failed to capture screenshot:', response);
      showNotification("Error capturing screenshot. Please try again.");
      cleanupSelection();
    }
  });
}

// Function to disable element selection
function disableElementSelector() {
  isActive = false;
  document.body.style.cursor = 'default';
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('click', handleElementClick);
}

// Function to crop image and download it
function cropAndDownloadImage(imageDataUrl, rect) {
  // Create an image object
  const image = new Image();
  image.onload = function() {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Set canvas dimensions to the element's dimensions
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Calculate device pixel ratio to handle high-DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Draw the portion of the image corresponding to the element
    context.drawImage(
      image,
      rect.x * devicePixelRatio,
      rect.y * devicePixelRatio,
      rect.width * devicePixelRatio,
      rect.height * devicePixelRatio,
      0,
      0,
      rect.width,
      rect.height
    );
    
    // Get the cropped image as a data URL
    const croppedImageDataUrl = canvas.toDataURL('image/png');
    
    // Download the image
    chrome.runtime.sendMessage({
      action: 'downloadImage',
      data: {
        dataUrl: croppedImageDataUrl,
        filename: `element-screenshot-${Date.now()}.png`
      }
    });
    
    // Cleanup
    cleanupSelection();
  };
  
  // Set the image source to the data URL
  image.src = imageDataUrl;
}

// Clean up after capturing
function cleanupSelection() {
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove('element-selector-selected');
    currentHighlightedElement = null;
  }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startSelection') {
    enableElementSelector();
    sendResponse({ status: 'started' });
  }
  
  // Must return true to indicate async response
  return true;
});

// Flag to track if we've already sent the ready message
let readyMessageSent = false;

// Function to notify background script that content script is loaded
function notifyBackgroundScript() {
  if (readyMessageSent) return; // Avoid sending multiple ready messages
  
  readyMessageSent = true;
  chrome.runtime.sendMessage({ action: 'contentScriptReady' }, response => {
    // Ignore any runtime errors that might occur
    if (chrome.runtime.lastError) {
      console.log('Background script not ready yet, ignoring error');
    }
  });
}

// Send a message to the background script that content script is loaded
notifyBackgroundScript();

// Also send the ready message when the page is fully loaded
if (document.readyState === 'complete') {
  notifyBackgroundScript();
} else {
  window.addEventListener('load', notifyBackgroundScript);
}
