function saveOptions () {
  let w = document.querySelector("input[name=BTH_editWinWidth]").value;
  let h = document.querySelector("input[name=BTH_editWinHeight]").value;
  // if user size entry is 0 or NaN, reset to default; otherwise constrain to sane range
  let maxW = window.screen.availWidth;    
  let maxH = window.screen.availHeight;
  w = Math.min(Math.max((parseInt(w) || 500), 15), maxW);
  h = Math.min(Math.max((parseInt(h) || 325), 15), maxH);
  
  browser.storage.local.set({ 
    defaultBookmarkPosition: document.querySelector("input[name=BTH_atFolder]:checked").value,
    menuitemBookmarkPosition: document.querySelector("input[name=BTH_atMenuitem]:checked").value,    
    bookmarkAllTabs: document.querySelector("input[name=BTH_bookmarkAllTabs]").checked,
    editorWin: document.querySelector("input[name=BTH_UI]:checked").value,
    dupPref: document.querySelector("input[name=BTH_moveToAvoidDup]").checked,
    winSize: [w,h]
  });
}

async function restoreOptions () {
  var savedOptions = await browser.storage.local.get(["defaultBookmarkPosition", "menuitemBookmarkPosition", "bookmarkAllTabs", "editorWin", "dupPref", "winSize"]);
  setOptions(savedOptions);

  function setOptions (savedOptions) {
    // when right-clicking folder, defaults to BTHfolderTop
    var id = (savedOptions.defaultBookmarkPosition == "bottom") ? "BTHfolderBottom" : "BTHfolderTop";
    document.getElementById(id).checked = true;

    // when right-clicking menuitem, defaults to BTHfolderTop BTHbelowMenuItem
    id = (savedOptions.menuitemBookmarkPosition == "above") ? "BTHaboveMenuItem" : "BTHbelowMenuItem";
    document.getElementById(id).checked = true;    

    // defaults to BTHctrl (only on Ctrl key)
    id = (savedOptions.editorWin == "all") ? "BTHall" : "BTHctrl";
    document.getElementById(id).checked = true;

    if (savedOptions.bookmarkAllTabs) {
      document.getElementById("BTH_allTabs").checked = "true";
    }
    if (savedOptions.dupPref) {
      document.getElementById("BTH_avoidDup").checked = "true";
    }
    if (savedOptions.winSize) {
      // let w = Math.min(Math.max(parseInt(savedOptions.winSize[0]), 15), 1000);
      // let h = Math.min(Math.max(parseInt(savedOptions.winSize[1]), 15), 1000);
      document.getElementById("BTH_winWidth").value = parseInt(savedOptions.winSize[0]);
      document.getElementById("BTH_winHeight").value = parseInt(savedOptions.winSize[1]);
    }
  }
}

var ids = ["BTHfolderTop", "BTHfolderBottom", "BTHaboveMenuItem", "BTHbelowMenuItem", "BTH_allTabs", "BTHctrl", "BTHall", "BTH_avoidDup", "BTH_winWidth", "BTH_winHeight"];
ids.forEach(id => {
  document.getElementById(id).addEventListener("change", saveOptions);
});

document.addEventListener("DOMContentLoaded", restoreOptions);
