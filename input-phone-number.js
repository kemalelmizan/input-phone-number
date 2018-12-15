var script = document.createElement("script");
script.src = "./jquery-3.3.1.min.js";
document.getElementsByTagName("head")[0].appendChild(script);

changeSlider = (slider, input) => {
  input.attr("disabled", "disabled");
  input.val(slider.val());
};

$(function() {
  $("form").on("submit", e => {
    e.preventDefault();
    return false;
  });
});

$(document).ready(() => {
  chrome.storage.sync.get(
    ["input_phone_number_enabled", "input_phone_number_level"],
    items => {
      if (items["input_phone_number_enabled"]) {
        console.log(
          "input_phone_number_enabled",
          items["input_phone_number_level"]
        );
        if (items["input_phone_number_level"] == 1) {
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
              max="999999999999"
              style="display: block;"
              value=0
              onchange="changeSlider($(this), $(this).prev())"/>`
            );
        } else if (items["input_phone_number_level"] == 2) {
          
        } else if (items["input_phone_number_level"] == 3) {
          $('input[type="number"]')
            .attr("disabled", "disabled")
            .css("border", "none")
            .css("font-size", "large")
            .val(0)
            .before(`<span style="font-size: large;">+</span>`)
            .after(
              `<video id="video" width="440" height="280" autoplay></video>
              <button id="snap">Guess?</button>
              <canvas hidden id="canvas" width="440" height="280"></canvas>`
            );
          var video = document.getElementById("video");

          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Not adding `{ audio: true }` since we only want video now
            navigator.mediaDevices
              .getUserMedia({ video: true })
              .then(function(stream) {
                //video.src = window.URL.createObjectURL(stream);
                video.srcObject = stream;
                video.play();
              });
          }
          var canvas = document.getElementById("canvas");
          var context = canvas.getContext("2d");
          var video = document.getElementById("video");

          document.getElementById("snap").addEventListener("click", function() {
            context.drawImage(video, 0, 0, 440, 280);
          });

          // segmenting by skin color (has to be adjusted)
          const skinColorUpper = hue => new cv.Vec(hue, 0.8 * 255, 0.6 * 255);
          const skinColorLower = hue => new cv.Vec(hue, 0.1 * 255, 0.05 * 255);

          const makeHandMask = img => {
            // filter by skin color
            const imgHLS = img.cvtColor(cv.COLOR_BGR2HLS);
            const rangeMask = imgHLS.inRange(
              skinColorLower(0),
              skinColorUpper(15)
            );

            // remove noise
            const blurred = rangeMask.blur(new cv.Size(10, 10));
            const thresholded = blurred.threshold(200, 255, cv.THRESH_BINARY);

            return thresholded;
          };

          const mhm1 = makeHandMask(canvas);
          console.log(mhm1);

          const getHandContour = handMask => {
            const contours = handMask.findContours(
              cv.RETR_EXTERNAL,
              cv.CHAIN_APPROX_SIMPLE
            );
            // largest contour
            return contours.sort((c0, c1) => c1.area - c0.area)[0];
          };

          // get the polygon from a contours hull such that there
          // will be only a single hull point for a local neighborhood
          const getRoughHull = (contour, maxDist) => {
            // get hull indices and hull points
            const hullIndices = contour.convexHullIndices();
            const contourPoints = contour.getPoints();
            const hullPointsWithIdx = hullIndices.map(idx => ({
              pt: contourPoints[idx],
              contourIdx: idx
            }));
            const hullPoints = hullPointsWithIdx.map(ptWithIdx => ptWithIdx.pt);

            // group all points in local neighborhood
            const ptsBelongToSameCluster = (pt1, pt2) =>
              ptDist(pt1, pt2) < maxDist;
            const { labels } = cv.partition(hullPoints, ptsBelongToSameCluster);
            const pointsByLabel = new Map();
            labels.forEach(l => pointsByLabel.set(l, []));
            hullPointsWithIdx.forEach((ptWithIdx, i) => {
              const label = labels[i];
              pointsByLabel.get(label).push(ptWithIdx);
            });

            // map points in local neighborhood to most central point
            const getMostCentralPoint = pointGroup => {
              // find center
              const center = getCenterPt(
                pointGroup.map(ptWithIdx => ptWithIdx.pt)
              );
              // sort ascending by distance to center
              return pointGroup.sort(
                (ptWithIdx1, ptWithIdx2) =>
                  ptDist(ptWithIdx1.pt, center) - ptDist(ptWithIdx2.pt, center)
              )[0];
            };
            const pointGroups = Array.from(pointsByLabel.values());
            // return contour indices of most central points
            return pointGroups
              .map(getMostCentralPoint)
              .map(ptWithIdx => ptWithIdx.contourIdx);
          };

          const getHullDefectVertices = (handContour, hullIndices) => {
            const defects = handContour.convexityDefects(hullIndices);
            const handContourPoints = handContour.getPoints();

            // get neighbor defect points of each hull point
            const hullPointDefectNeighbors = new Map(
              hullIndices.map(idx => [idx, []])
            );
            defects.forEach(defect => {
              const startPointIdx = defect.at(0);
              const endPointIdx = defect.at(1);
              const defectPointIdx = defect.at(2);
              hullPointDefectNeighbors.get(startPointIdx).push(defectPointIdx);
              hullPointDefectNeighbors.get(endPointIdx).push(defectPointIdx);
            });

            return (
              Array.from(hullPointDefectNeighbors.keys())
                // only consider hull points that have 2 neighbor defects
                .filter(
                  hullIndex =>
                    hullPointDefectNeighbors.get(hullIndex).length > 1
                )
                // return vertex points
                .map(hullIndex => {
                  const defectNeighborsIdx = hullPointDefectNeighbors.get(
                    hullIndex
                  );
                  return {
                    pt: handContourPoints[hullIndex],
                    d1: handContourPoints[defectNeighborsIdx[0]],
                    d2: handContourPoints[defectNeighborsIdx[1]]
                  };
                })
            );
          };

          const filterVerticesByAngle = (vertices, maxAngleDeg) =>
            vertices.filter(v => {
              const sq = x => x * x;
              const a = v.d1.sub(v.d2).norm();
              const b = v.pt.sub(v.d1).norm();
              const c = v.pt.sub(v.d2).norm();
              const angleDeg =
                Math.acos((sq(b) + sq(c) - sq(a)) / (2 * b * c)) *
                (180 / Math.PI);
              return angleDeg < maxAngleDeg;
            });
        }
      }
    }
  );
});
