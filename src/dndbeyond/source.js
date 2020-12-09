/*
from settings import getStoredSettings;
from dndbeyond import injectDiceToRolls, isRollButtonAdded, Source;
from elementmaker import E;
from utils import alertFullSettings;
*/

console.log("Green Room: D&D Beyond Spell module loaded.");

let character = null;

function addDisplayButton(src) {
    const icon = chrome.extension.getURL("images/icons/icon32.png");
    const button = E.a({ class: "ct-green-room-roll button-alt green-room-dont-import", href: "#" },
        E.span({ class: "label" },
            E.img({ class: "ct-green-room-source-icon", src: icon, style: "margin-right: 10px;" }),
            "Import into Foundry VTT"
        )
    );
    $('.green-room-dont-import').remove();
    $(".top-next-nav").after(button);
    $(".ct-green-room-roll").css({
        "float": "right",
        "display": "inline-block"
    });
    $(".ct-green-room-roll").on('click', (event) => src.parse($("body")));
}

function documentLoaded(settings) {
    const src = new SourceBase(settings);
    if (isRollButtonAdded()) {
        chrome.runtime.sendMessage({ "action": "reload-me" });
    } else {
        addDisplayButton(src);
    }
}

function updateSettings(new_settings = null) {
    if (new_settings) {
        if (character)
            character.setGlobalSettings(new_settings);
    } else {
        getStoredSettings((saved_settings) => {
            documentLoaded(saved_settings);
            updateSettings(saved_settings);
        });
    }
}

function handleMessage(request, sender, sendResponse) {
    if (request.action == "settings") {
        if (request.type == "general")
            updateSettings(request.settings);
    } else if (request.action == "open-options") {
        alertFullSettings();
    }
}

chrome.runtime.onMessage.addListener(handleMessage);
chrome.runtime.sendMessage({ "action": "activate-icon" });
updateSettings();
