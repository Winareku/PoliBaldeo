let isOpen = false;

browser.browserAction.onClicked.addListener(async () => {
  if (isOpen) {
    await browser.sidebarAction.close();
  } else {
    await browser.sidebarAction.open();
  }

  isOpen = !isOpen;
});
