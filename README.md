## Installing
### Release Versions
* Available at AMO page: https://addons.mozilla.org/firefox/addon/bookmark-tab-here/
### Prerelease Versions

* In the right-side panel, click Releases. Expand Assets, then click the .xpi file you want to install; Firefox should prompt you to install it.


## Usage
* Right-click a bookmarks folder (in Bookmarks Menu, Bookmarks Toolbar, Bookmarks Button, Bookmarks Sidebar or Library) and click 'Bookmark Tab(s) Here' to insert bookmark(s) of currently selected tab(s) at top (or optionally at bottom) of that folder. 
* Right click individual bookmark menuitem instead, to insert bookmark of currently selected tab(s) below (or optionally above) that item.

* Ctrl-click 'Bookmark Tab Here' to edit (single) bookmark name and/or create new folder into which to insert bookmark(s). Or set Option to always display Editor.

## FAQ
* Can the context menu item be moved to the top of the menu? 
 
 This cannot be done via the extension, but if you're familiar with userChrome.css you can do it from there with the following code:

	
	@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);
	@-moz-document url(chrome://browser/content/browser.xhtml),
	url(chrome://browser/content/browser.xul) {
	#_bc21b9a1-3ad6-4b00-bca4-ef5b7e21253b_-menuitem-_BTH {
	order: -1;
	}
	

