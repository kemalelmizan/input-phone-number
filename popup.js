document.getElementById("save").addEventListener("click", () => {
  var isEnabled = document.getElementById("isEnabled").checked;
  var level = document.getElementById("level").value;

  localStorage["input_phone_number_enabled"] = isEnabled;
  localStorage["input_phone_number_level"] = level;

  chrome.storage.sync.set({ input_phone_number_enabled: isEnabled, input_phone_number_level: level }, () => {
    console.log("Settings saved: ", isEnabled, level);
  });
});

document.getElementById("erase").addEventListener("click", () => {
  localStorage.removeItem("input_phone_number_enabled");
  localStorage.removeItem("input_phone_number_level");
  location.reload();
});

document.addEventListener("DOMContentLoaded", () => {
  const isEnabled =
    localStorage["input_phone_number_enabled"] === "true" ? true : false;
  document.getElementById("isEnabled").checked = isEnabled;
  document.getElementById("level").value = localStorage["input_phone_number_level"];
});
