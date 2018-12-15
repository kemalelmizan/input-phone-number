var script = document.createElement("script");
script.src = "./jquery-3.3.1.min.js";
document.getElementsByTagName("head")[0].appendChild(script);

changeSlider = (slider, input) => {
  input.attr("disabled", "disabled");
  input.val(slider.val());
};

$(document).ready(() => {
  chrome.storage.sync.get(
    ["input_phone_number_enabled", "input_phone_number_level"],
    items => {
      if (items["input_phone_number_enabled"]) {
        console.log(
          "input_phone_number_enabled",
          items["input_phone_number_level"]
        );
        $('input[type="number"]')
          .attr("disabled", "disabled")
          .css("border", "none")
          .css("font-size", "large")
          .val(0)
          .before(`<span style="font-size: large;">+</span>`)
          .after(
            `<input 
          type="range" 
          min="0" 
          max="9999999999999"
          style="display: block;"
          value=0
          onchange="changeSlider($(this), $(this).prev())"/>`
          );
      }
    }
  );
});
