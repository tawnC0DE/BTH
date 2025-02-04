// used by popup.htm

var origTitle = null;
addEventListener("load", init);
addEventListener("beforeunload", warn, { once:true });

browser.runtime.onMessage.addListener(initInputBox);

function warn () {
  console.log("Bookmark Tab Here: Closing the popup window has canceled bookmarking the tab(s)");
  browser.runtime.sendMessage({ content: "cancel"} );
}

function init (e) {
  var button = document.getElementById('ok');
  button.addEventListener("click", sendNewFolderName, { once:true });
  var sending = browser.runtime.sendMessage({ content: "sendTitleEtc" });
  sending.then(initInputBox);  
}

function initInputBox (message) {
  if(message.msg == "warn") {
	  console.log("Bookmark Tab Here could not perform current action due to previous editor window still open."); 
	  alert(message.warningTxt); 
    return;
	}
	
  var BTH = message.BTH;
  var elem = document.getElementsByTagName('h1')[0];
  elem.innerText = BTH;
  elem = document.getElementsByTagName('title')[0];
  elem.innerText = BTH;

  var folderQ = message.folderLabel;
  elem = document.getElementsByTagName('label');
  var label1 = elem[0];
  var label2 = elem[1];
  label1.innerText = folderQ;
  var titleQ = message.titleLabel;   
  label2.innerText = titleQ;
  
  var buttonTxt = message.btnText;   
  elem = document.getElementById("ok");
  elem.innerText = buttonTxt;
  
  var placeholder = message.placeholderText;
  elem = document.getElementById("foldername");
  elem.setAttribute("placeholder", placeholder);
  
  var hint = message.hint;   
  elem = document.getElementById("cancel");
  elem.innerText = hint;
  
   
  // response from background script 
  //(in reply to request for title of page to be bookmarked -
  // so we can prefill input box with it)
  var title = message.bookmarkTitle;
  var BMtitle = document.getElementById('bookmarktitle');
  if (title) {
    BMtitle.setAttribute('value', title);
    origTitle = title;
    BMtitle.removeAttribute("disabled");
  } else {
    BMtitle.setAttribute("disabled", true);
  }
}

function sendNewFolderName (e) {
  // notify background script of new folder name entered by user
  var name = document.getElementById('foldername').value;
  var title = document.getElementById('bookmarktitle').value;
  if (title == origTitle) {
    title = null;
  }
  browser.runtime.sendMessage({ folderName: name, newTitle: title });
  // purpose of popup.htm fulfilled: "beforeunload" is now expected and requires no warning
  removeEventListener("beforeunload", warn, { once:true });
}


