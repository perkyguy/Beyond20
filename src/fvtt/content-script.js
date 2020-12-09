/*from utils import sendCustomEvent, injectPageScript, alertQuickSettings, alertFullSettings;
from settings import getDefaultSettings, getStoredSettings;
from elementmaker import E;
*/

console.log("Green Room: Foundry VTT module loaded.");

var settings = getDefaultSettings();

function updateSettings(new_settings = null) {
    if (new_settings) {
        settings = new_settings;
        sendCustomEvent("NewSettings", [settings, chrome.runtime.getURL("")]);
    } else {
        getStoredSettings(updateSettings)
    }
}

function handleMessage(request, sender, sendResponse) {
    console.log("Got message : ", request);
    if (request.action == "settings") {
        if (request.type == "general")
            updateSettings(request.settings);
    } else if (request.action == "scene-import") {
        console.log('SceneImport', request);
        sendCustomEvent("SceneImport", [request]);
    } else if (request.action == "open-options") {
        alertFullSettings();
    }
}

function titleSet(mutations, observer) {
    updateSettings();
    chrome.runtime.onMessage.addListener(handleMessage);
    chrome.runtime.sendMessage({ "action": "register-fvtt-tab" });
    injectSettingsButton();
    observer.disconnect();
}

function injectSettingsButton() {
    $(".beyond20-settings").remove();

    icon = chrome.extension.getURL("images/icons/badges/normal24.png");
    button = E.div({ class: "beyond20-settings", style: "flex: 0 0 32px;" },
        E.img({ class: "beyond20-settings-logo", src: icon, style: "margin: 0px 5px; border: 0px;" })
    );
    $("#chat-controls").append(button);
    $(button).on('click', (event) => alertQuickSettings());
}

const observer = new window.MutationObserver(titleSet);
observer.observe(document.getElementsByTagName("title")[0], { "childList": true });
sendCustomEvent("disconnect");
injectPageScript(chrome.runtime.getURL("libs/alertify.min.js"));
injectPageScript(chrome.runtime.getURL('dist/fvtt_script.js'));
