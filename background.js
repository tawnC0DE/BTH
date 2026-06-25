browser.runtime.onInstalled.addListener(createContextMenuItem);
browser.runtime.onMessage.addListener(contentMsgHandler);

// Create BTH context menu item
function createContextMenuItem (){
  browser.menus.create({
    id: "BTH",
    title: browser.i18n.getMessage("BTH_menuitemText"),
    contexts: ["bookmark"]
  });
}

async function contentMsgHandler (request, sender, sendResponse) {
  var req = request.content;
  switch (req) {
    case "sendTitleEtc":  // info for the editor window popup
      // no need for sendResponse; just return the promise
      return browser.storage.session.get({"Title": ""})
             .then (result => result);
    case "cancel":
      await browser.storage.session.remove("popupId");
      await browser.storage.session.remove("popupTabId");
      break;
    default:
      processEditorInfo(request);
  }
}

async function processEditorInfo (info) {
  var foldername = info.folderName;
  var newTitle = info.newTitle;

  let data =  await browser.storage.session.get({
    "Tabs": "",
    "Folder": "",
    "Index": 0
  });

  createEditedBookmarks(data.Index, data.Folder, foldername, newTitle, data.Tabs);
  // sender.tab will be undefined if background script gets terminated before user clicks to save bookmark(s)!
  // browser.windows.remove(sender.tab.windowId);

  let winPopupId = await getSessionSetting("popupId", "");
  // close created UI window and delete saved window/tab id's
  await browser.windows.remove(winPopupId);
  await browser.storage.session.remove(["popupId", "popupTabId"]);
}

// el called when BTH contextmenu entry is clicked
browser.menus.onClicked.addListener((info) => {
  if (info.menuItemId != "BTH")
    return;
  // info.modifiers available in Fx64+  Bug1469148   https://hg.mozilla.org/integration/autoland/rev/b2a53a75ba3d48968e209bc679fb744c3280d666
  bookmarkTabs(info.bookmarkId, info.modifiers);
});

async function warnUserIgnoredEditor () {
  let editorPopupTab = await getSessionSetting("popupTabId", "");
  let editorPopupWin = await getSessionSetting("popupId", "");
  // trigger alert and focus popup
  let warning = browser.i18n.getMessage("BTH_warning");
  browser.tabs.sendMessage(editorPopupTab, {msg: "warn", warningTxt: warning});
  browser.windows.update(editorPopupWin, {focused: true});
}

async function getSetting (settingRequested, defaultVal) {
  var settingObj = await browser.storage.local.get(settingRequested);
  return settingObj[settingRequested] ?? defaultVal;
}

async function getSessionSetting (settingRequested, defaultVal) {
  var settingObj = await browser.storage.session.get(settingRequested);
  return settingObj[settingRequested] ?? defaultVal;
}

async function addBookmarks (tabs, index, folder, newTitle) {
  var name = null;
  if (newTitle && tabs.length == 1) {
    name = newTitle;
  }

  tabs.reverse();

  for (let tab of tabs) {
    var tabUrl = decodeURIComponent(tab.url);
    // current workaround to avoid BTH failing to set bookmark on typical 'about:' pages (including reader mode pages)
    // (search does not accept the url as a proper url format due to Bug 1352835 : "bookmarks.search fails on non-http(s) URLs")
    var isAboutPage = tabUrl.startsWith("about:") || tabUrl.startsWith("file:");
    // Could search for url as a string rather than {url:URL} object as workaround for Bug 1352835
    // but when searching as a string "Each search term matches if it is a *substring* in the bookmark's URL"
    // i.e.  www.foo.com matches www.foo.com/bar/foo.htm which is not an identical url and should definitely not be considered a dup!
    var searchForDup = await getSetting("dupPref", "false");
    var nodes = (searchForDup && !isAboutPage) ?  await browser.bookmarks.search({ url: tabUrl }) :  await Promise.resolve([]);
    if (nodes.length) {   // found a dup
    // move returns a promise, ideally we should wait for it and save new bookmark if rejected (IOW, do the below 'else' if unable to move)
      browser.bookmarks.move(
      nodes[0].id,    // purpose is not to find every dup; just move the 1st match we find thus avoiding /creating/ a dup
      {index: index, parentId: folder}
      );
    } else {
      var bookmarkName = name || tab.title; // non-null name implies tabs.length == 1
      browser.bookmarks.create({index: index, parentId: folder, title: bookmarkName, url: tab.url});
    }
  }
}

function getTabs (which) {
  // Fx 63+ supports multiselected (highlighted) tabs; previously highlighted was alias for active tab
  var queryObj = (which == "selected") ? {highlighted: true, currentWindow: true} : {currentWindow: true};
  return browser.tabs.query(queryObj);
}

async function getIndex (menuitem, bookmarkTreeNode) {
  var position;
  if (bookmarkTreeNode.type != "folder") { // contextmenu of a menuitem
    // set bookmark above or below menuitem depending on option
    position = await getSetting("menuitemBookmarkPosition", "below");
    var offset = (position == "below") ? 1 : 0;  // set to 1 for below menuitem or 0 for above menuitem
    return bookmarkTreeNode.index + offset;
  } else { // contextmenu of a folder
    // set bookmark at top/bottom of menu depending on option
    position = await getSetting("defaultBookmarkPosition", "top");
    return (position != "bottom") ? 0 : bookmarkTreeNode.children.length;
  }
}

async function openEditorPopup () {
  var popupSize = await browser.storage.local.get(["winSize"]);
  // if option not set, use default width/height
  let w = popupSize?.winSize?.[0] || 500;
  let h = popupSize?.winSize?.[1] || 325;

  let editorPopup = await browser.windows.create({
    url: "/popup.htm",
    type: "popup",
    width: w,
    height: h
});

  await browser.storage.session.set({
    popupTabId: editorPopup.tabs[0].id,
    popupId: editorPopup.id
  });
}

async function bookmarkTabs (menuitem, modif) {
  let popupWinOpen = await getSessionSetting("popupId", "");

  if (popupWinOpen) {
    // if our previous editor window is still open, block further actions to avoid destroying previous bookmarking info
    warnUserIgnoredEditor();
    return;
  }

  var ShiftKey = modif.includes('Shift');
  var editorSetting = await getSetting("editorWin", "ctrl");
  var alwaysShowEditor = (editorSetting == "all") ? true: false;
  var showEditor = alwaysShowEditor || modif.includes('Ctrl');
  var bookmarkAllTabsEnabled =  await getSetting("bookmarkAllTabs", "false");
  var gettingTabs = (ShiftKey && bookmarkAllTabsEnabled) ? getTabs("all") : getTabs("selected");
  var obtainingTree = browser.bookmarks.getSubTree(menuitem);
  var gettingInfo = await Promise.all([obtainingTree, gettingTabs]);

  var tabs = gettingInfo[1];
  var title = (tabs.length == 1) ? tabs[0].title : ""; // title will not be editable if > 1 tab to bookmark
  if (showEditor) { // user wants to specify details of bookmark (new folder/rename)
    await openEditorPopup(); // do ASAP to avoid lag, but need title available for content script's request
  }
  var node = gettingInfo[0];
  var bookmarkTreeNode = node[0]; // see BookmarkTreeNodeType
  var folder = (bookmarkTreeNode.type == "folder") ? menuitem : bookmarkTreeNode.parentId;
  var index = await getIndex(menuitem, bookmarkTreeNode);

  browser.storage.session.set({
    Title: title,
    Tabs: tabs,
    Folder: folder,
    Index: index
  });

  if (!showEditor) { // showEditor processing finishes after getting user input
    addBookmarks(tabs, index, folder, null);
    return;
  }
}

async function createEditedBookmarks (index, folder, foldername, newTitle, tabs) {
  var folderId;
  var newFolder;
  if (foldername) { // user wants items bookmarked into a new folder
    // create the requested new folder
    var createBookmarkFolder = browser.bookmarks.create({
      index: index,
      parentId: folder,
      title: foldername
    });
    newFolder = await createBookmarkFolder;
    folderId = newFolder.id;
  }
  folderId = (foldername) ? newFolder.id : folder;
  addBookmarks(tabs, index, folderId, newTitle);
}
