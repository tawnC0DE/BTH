var defaultToMenuTop = true;        // for contextmenu of *folder*
var defaultToBelowMenuitem = true;  // for contextmenu of a *menuitem*
var bookmarkAllTabsEnabled = false;
var alwaysShowEditor = false;
var editorPopup = null;
var searchForDup = null;

// Create BTH context menu item
browser.menus.create({
  id: "BTH",
  title: browser.i18n.getMessage("BTH_menuitemText"),
  contexts: ["bookmark"]
});

// Obtain our options initial settings
getSettings();

// el called when BTH contextmenu entry is clicked
browser.menus.onClicked.addListener((info) => {
  if (info.menuItemId != "BTH")
    return;
  // info.modifiers available in Fx64+  Bug1469148   https://hg.mozilla.org/integration/autoland/rev/b2a53a75ba3d48968e209bc679fb744c3280d666
  if (editorPopup) {
    // if our previous editor window is still open, trigger alert and focus popup
    warnUser(editorPopup);
  } else {
    bookmarkTabs(info.bookmarkId, info.modifiers);
  }
});

async function warnUser (editorPopup) {
  // we must block further actions to avoid destroying previous bookmarking info
  let warning = browser.i18n.getMessage("BTH_warning"); 
  // editorPopup is a promise, wait for actual popup window creation
  let win = await editorPopup;
  browser.tabs.sendMessage(win.tabs[0].id, {msg: "warn", warningTxt: warning});
  browser.windows.update(win.id, {focused: true});
}

async function getSettings() {
  var settings = await browser.storage.local.get(["defaultBookmarkPosition", "menuitemBookmarkPosition", "bookmarkAllTabs", "editorWin", "dupPref"]);
  // defaultBookmarkPosition will be undefined if value not previously stored
  if (settings.defaultBookmarkPosition && settings.defaultBookmarkPosition == "bottom") {
    defaultToMenuTop = false;
  }
  // menuitemBookmarkPosition will be undefined if value not previously stored
  if (settings.menuitemBookmarkPosition && settings.menuitemBookmarkPosition == "above") {
    defaultToBelowMenuitem = false;
  }
  if (settings.editorWin == "all") {
    alwaysShowEditor = true;
  }
  if (settings.dupPref) {
    searchForDup = true;
  }
  bookmarkAllTabsEnabled = Boolean(settings.bookmarkAllTabs); // if value not previously stored, undefined->false
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

function getIndex (menuitem, bookmarkTreeNode) {
  if (bookmarkTreeNode.type != "folder") { // contextmenu of a menuitem
    // set bookmark above or below menuitem depending on option
    var offset = (defaultToBelowMenuitem) ? 1 : 0;  // set to 1 for below menuitem or 0 for above menuitem
    return bookmarkTreeNode.index + offset;
  } else { // contextmenu of a folder
    // set bookmark at top/bottom of menu depending on option
    return (defaultToMenuTop) ? 0 : bookmarkTreeNode.children.length;
  }
}

async function openEditorPopup () {
  var popupSize = await browser.storage.local.get(["winSize"]);
  // if option not set, use default width/height
  let w = popupSize?.winSize?.[0] || 500; 
  let h = popupSize?.winSize?.[1] || 325; 
      
  editorPopup = browser.windows.create({
    url: "/popup.htm",
    type: "popup",
    width: w,
    height: h
  });
}
 
async function bookmarkTabs (menuitem, modif) {
  var ShiftKey = modif.includes('Shift');
  var showEditor = alwaysShowEditor || modif.includes('Ctrl');
  var gettingTabs = (ShiftKey && bookmarkAllTabsEnabled) ? getTabs("all") : getTabs("selected");
  var obtainingTree = browser.bookmarks.getSubTree(menuitem);
  var gettingInfo = await Promise.all([obtainingTree, gettingTabs]);

  var tabs = gettingInfo[1];
  var title = (tabs.length == 1) ? tabs[0].title : ""; // title will not be editable if > 1 tab to bookmark
  if (showEditor) { // user wants to specify details of bookmark (new folder/rename)
    openEditorPopup(); // do ASAP to avoid lag, but need title available for content script's request
  }
  var node = gettingInfo[0];
  var bookmarkTreeNode = node[0]; // see BookmarkTreeNodeType
  var folder = (bookmarkTreeNode.type == "folder") ? menuitem : bookmarkTreeNode.parentId;
  var index = getIndex(menuitem, bookmarkTreeNode);
  if (!showEditor) { // showEditor processing finishes after getting user input
    addBookmarks(tabs, index, folder, null);
    return;
  }
  function contentMsgHandler (request, sender, sendResponse) {
    var req = request.content;
    switch (req) {
      case "sendTitleEtc":  // info for the editor window popup
        sendResponse({bookmarkTitle: title, 
                      BTH: browser.i18n.getMessage("extensionName"),  
                      folderLabel: browser.i18n.getMessage("BTH_newFolderQ"), 
                      titleLabel: browser.i18n.getMessage("BTH_titleEdit"), 
                      btnText: browser.i18n.getMessage("BTH_dlgBtnText"), 
                      placeholderText: browser.i18n.getMessage("BTH_placeholder"),
                      hint: browser.i18n.getMessage("BTH_cancelHint")
                    });
        break;
      case "cancel":
        browser.runtime.onMessage.removeListener(contentMsgHandler);
        editorPopup = null;
        break;
      default:
        var foldername = request.folderName;
        var newTitle = request.newTitle;
        browser.windows.remove(sender.tab.windowId); // close created UI window
        editorPopup = null;
        createEditedBookmarks(index, folder, foldername, newTitle, tabs);
        browser.runtime.onMessage.removeListener(contentMsgHandler);
    }
  }
  browser.runtime.onMessage.addListener(contentMsgHandler);
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

browser.storage.onChanged.addListener(updateOptions);

function updateOptions (changes) {
  defaultToMenuTop = changes.defaultBookmarkPosition?.newValue != "bottom";
  defaultToBelowMenuitem = changes.menuitemBookmarkPosition?.newValue != "above";  
  alwaysShowEditor = changes.editorWin?.newValue == "all";
  bookmarkAllTabsEnabled = changes.bookmarkAllTabs.newValue;
  searchForDup = changes.dupPref.newValue;
}
