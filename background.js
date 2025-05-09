// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "captureElement",
    title: "Capture Element Screenshot",
    contexts: ["page", "selection", "image", "link"]
  });
  
  // Clear any error messages that might be in the console
  console.clear();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "captureElement") {
    // Make sure we can inject into this page
    if (!tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('edge://') && 
        !tab.url.startsWith('brave://') &&
        !tab.url.includes('chrome.google.com/webstore') &&
        !tab.url.includes('addons.mozilla.org')) {
      // Send message to the content script to start selection
      chrome.tabs.sendMessage(tab.id, { action: 'startSelection' }, (response) => {
        if (chrome.runtime.lastError) {
          // If the content script isn't loaded yet, inject it
          console.log('Content script not ready, injecting it now');
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            // After injecting, try sending the message again
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
            }, 100);
          }).catch(err => console.error('Error injecting content script:', err));
        }
      });
    } else {
      console.error('Cannot access this page due to browser restrictions');
    }
  }
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle content script ready message
  if (message.action === 'contentScriptReady') {
    console.log('Content script is ready for tab:', sender.tab?.id);
    return;
  }
  
  // Handle element capture request
  if (message.action === 'captureElement') {
    try {
      // Capture the visible tab
      chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Error capturing tab:', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }
        
        // Send the image data URL back to the content script
        sendResponse({ imageDataUrl: dataUrl });
      });
    } catch (error) {
      console.error('Error in captureVisibleTab:', error);
      sendResponse({ error: error.message });
    }
    
    // Return true to indicate that response is sent asynchronously
    return true;
  }
  
  // Handle download request
  if (message.action === 'downloadImage') {
    chrome.downloads.download({
      url: message.data.dataUrl,
      filename: message.data.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Error downloading image:', chrome.runtime.lastError);
      } else {
        console.log('Download started with ID:', downloadId);
      }
    });
  }
});

// Handle browser action click
chrome.action.onClicked.addListener((tab) => {
  // Make sure we can inject into this page
  if (!tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('edge://') && 
      !tab.url.startsWith('brave://') &&
      !tab.url.includes('chrome.google.com/webstore') &&
      !tab.url.includes('addons.mozilla.org')) {
    // Send message to the content script to start selection
    chrome.tabs.sendMessage(tab.id, { action: 'startSelection' }, (response) => {
      if (chrome.runtime.lastError) {
        // If the content script isn't loaded yet, inject it
        console.log('Content script not ready, injecting it now');
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).then(() => {
          // After injecting, try sending the message again
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
          }, 100);
        }).catch(err => console.error('Error injecting content script:', err));
      }
    });
  } else {
    console.error('Cannot access this page due to browser restrictions');
  }
});
