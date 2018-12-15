var script = document.createElement("script");
script.src = "./jquery-3.3.1.min.js";
document.getElementsByTagName("head")[0].appendChild(script);

var currentPiDigit = 0;

prevDigit = () => {
  if (currentPiDigit <= 1) return false;
  currentPiDigit -= 1000;
  $.get(
    "https://api.pi.delivery/v1/pi",
    {
      start: currentPiDigit,
      numberOfDigits: 1000
    },
    data => {
      $(".pi").text(data.content);
    }
  );
};

nextDigit = () => {
  currentPiDigit += 1000;
  $.get(
    "https://api.pi.delivery/v1/pi",
    {
      start: currentPiDigit,
      numberOfDigits: 1000
    },
    data => {
      $(".pi").text(data.content);
    }
  );
};

changeSlider = (slider, input) => {
  input.attr("disabled", "disabled");
  input.val(slider.val().replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3"));
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
          // slider
          $('input[type="number"]')
            .attr("disabled", "disabled")
            .attr("type", "text")
            .css("border", "none")
            .css("font-size", "large")
            .val(0)
            // .before(`<span style="font-size: large;">+</span>`)
            .after(
              `<input 
              type="range" 
              min="0" 
              max="999999999"
              style="display: block; width: 100%;"
              value=0
              onchange="changeSlider($(this), $(this).prev())"/>`
            );
        } else if (items["input_phone_number_level"] == 2) {
          // rotary phone
          $('input[type="number"]')
            .css("display", "none")
            .val(0)
            .after(`<canvas id="retrophone"></canvas>`);
          RPH = {};

          RPH.math = {
            getDistance: function(x1, y1, x2, y2) {
              return Math.pow(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2), 0.5);
            },

            getAngle: function(x1, y1, x2, y2) {
              var angle;

              if (Math.abs(x1 - x2) < RPH.W / 100 && y2 > y1)
                return (1 * Math.PI) / 2;
              if (Math.abs(x1 - x2) < RPH.W / 100 && y2 < y1)
                return (3 * Math.PI) / 2;

              angle = Math.atan((y2 - y1) / (x2 - x1));

              if (x1 < x2) {
                if (angle < 0) return angle + 2 * Math.PI;
                return angle;
              }

              return angle + Math.PI;
            }
          };

          RPH.mouse = {
            x: 0,
            y: 0,
            xDrag: 0,
            yDrag: 0,
            isDragging: false,

            get: function(e) {
              var rect = RPH.canvas.getBoundingClientRect();
              this.x = e.clientX - rect.left;
              this.y = e.clientY - rect.top;
            },

            down: function(e) {
              this.get(e);
              this.xDrag = this.x;
              this.yDrag = this.y;
              this.isDragging = true;
            },

            up: function(e) {
              this.get(e);
              this.isDragging = false;
            },

            move: function(e) {
              this.get(e);
            },

            draw: function(e) {
              RPH.pen.circle(this.x, this.y, 5);
            }
          };

          RPH.pen = {
            clear: function() {
              RPH.ctx.clearRect(0, 0, RPH.W, RPH.H);
            },

            rect: function(x, y, w, h) {
              RPH.ctx.beginPath();
              RPH.ctx.rect(x, y, w, h);
              RPH.ctx.closePath();
              RPH.ctx.fill();
            },

            circle: function(x, y, r) {
              RPH.ctx.beginPath();
              RPH.ctx.arc(x, y, r, 0, Math.PI * 2, true);
              RPH.ctx.fill();
            }
          };

          RPH.phone = {
            alpha: 0,
            alphaPrev: 0,
            oBeta: (Math.PI * 4) / 9,
            dBeta: Math.PI / 7,
            rBeta: Math.PI / 24,

            r0: 0.35,
            r2: 0.23,
            r1: 0.29,
            r3: 0.04,

            fontString: "",

            activeDigit: -1,

            setDrag: function() {
              var xc = this.centroid.x,
                yc = this.centroid.y;

              this.alpha =
                RPH.math.getAngle(
                  RPH.W * xc,
                  RPH.H * yc,
                  RPH.mouse.x,
                  RPH.mouse.y
                ) -
                RPH.math.getAngle(
                  RPH.W * xc,
                  RPH.H * yc,
                  RPH.mouse.xDrag,
                  RPH.mouse.yDrag
                );

              // dialing only works forward
              this.alpha = this.alpha < 0 ? 0 : this.alpha;

              if (
                this.alpha >
                (10 - this.activeDigit) * this.dBeta + this.rBeta
              ) {
                RPH.mouse.isDragging = false;

                if (RPH.dialer.number.length < 12)
                  RPH.dialer.number += this.activeDigit;
                if (
                  RPH.dialer.number.length === 3 ||
                  RPH.dialer.number.length === 7
                )
                  RPH.dialer.number += "-";

                this.activeDigit = -1;
              }
            },

            setActiveDigit: function() {
              var angle;

              this.activeDigit = -1;

              for (i = 0; i < 10; i += 1) {
                angle = this.oBeta + this.dBeta * i + this.alpha;

                xt =
                  RPH.W * this.centroid.x +
                  RPH.minWH * this.r1 * Math.cos(angle);
                yt =
                  RPH.H * this.centroid.y +
                  RPH.minWH * this.r1 * Math.sin(angle);

                if (
                  RPH.math.getDistance(RPH.mouse.x, RPH.mouse.y, xt, yt) <
                  RPH.minWH * this.r3
                ) {
                  this.activeDigit = i;
                }
              }
            },

            drawRing: function() {
              var xc = this.centroid.x,
                yc = this.centroid.y;

              RPH.ctx.fillStyle = "#444444";
              RPH.pen.circle(RPH.W * xc, RPH.H * yc, RPH.minWH * this.r0);

              RPH.ctx.fillStyle = "rgb(240,245,240)";
              RPH.pen.circle(RPH.W * xc, RPH.H * yc, RPH.minWH * this.r2);
            },

            drawLine: function() {
              var angle = this.oBeta + 10 * this.dBeta + this.rBeta,
                xc = this.centroid.x,
                yc = this.centroid.y;

              RPH.ctx.strokeStyle = "rgb(240,245,240)";

              RPH.ctx.beginPath();
              RPH.ctx.moveTo(
                RPH.W * xc + this.r0 * RPH.minWH * Math.cos(angle),
                RPH.H * yc + this.r0 * RPH.minWH * Math.sin(angle)
              );
              RPH.ctx.lineTo(
                RPH.W * xc + this.r1 * RPH.minWH * Math.cos(angle),
                RPH.H * yc + this.r1 * RPH.minWH * Math.sin(angle)
              );
              RPH.ctx.lineWidth = RPH.minWH / 150;
              RPH.ctx.stroke();
            },

            drawNumber: function() {
              RPH.ctx.font = RPH.minWH / 25 + "px " + this.fontString;
              RPH.ctx.fillStyle = "#444444";
              RPH.ctx.fillText(
                RPH.dialer.number,
                RPH.W * this.text.x,
                RPH.H * this.text.y
              );
            },

            drawDigits: function() {
              var i, angle;

              RPH.ctx.font = RPH.minWH / 18 + "px Courier";

              for (i = 0; i < 10; i += 1) {
                RPH.ctx.fillStyle =
                  this.activeDigit === i
                    ? "rgb(180,205,200)"
                    : "rgb(240,245,240)";

                angle = RPH.phone.oBeta + RPH.phone.dBeta * i + RPH.phone.alpha;
                RPH.pen.circle(
                  RPH.W * this.centroid.x +
                    RPH.minWH * this.r1 * Math.cos(angle),
                  RPH.H * this.centroid.y +
                    RPH.minWH * this.r1 * Math.sin(angle),
                  RPH.minWH * this.r3
                );

                RPH.ctx.fillStyle = "#444444";
                angle = RPH.phone.oBeta + RPH.phone.dBeta * i;

                RPH.ctx.fillText(
                  i,
                  RPH.W * this.centroid.x +
                    RPH.minWH * this.r1 * Math.cos(angle),
                  RPH.H * this.centroid.y +
                    RPH.minWH * this.r1 * Math.sin(angle)
                );
              }
            },

            centroid: {
              x: 0.5,
              y: 0.55
            },

            text: {
              x: 0.5,
              y: 0.1,
              isHovered: function() {
                return (
                  RPH.mouse.y / RPH.minWH < this.y + 0.02 &&
                  RPH.mouse.y / RPH.minWH > this.y - 0.02
                );
              }
            }
          };

          RPH.dialer = {
            number: "",

            dial: function() {
              window.location = "tel:" + this.number;
            }
          };

          RPH.mouseUp = function(e) {
            RPH.mouse.up(e);
          };

          RPH.mouseDown = function(e) {
            RPH.mouse.down(e);

            RPH.mouse.isDragging =
              RPH.phone.alpha < 0.03 && RPH.phone.activeDigit !== -1;

            if (RPH.phone.text.isHovered()) {
              RPH.dialer.dial();
            }
          };

          RPH.mouseMove = function(e) {
            RPH.mouse.move(e);

            if (RPH.mouse.isDragging) {
              RPH.phone.setDrag();
            } else if (RPH.phone.alpha < 0.03) {
              RPH.phone.setActiveDigit();
            }

            RPH.fontString = RPH.phone.text.isHovered() ? "bold " : "";
            RPH.fontString += RPH.minWH / 30 + "px Courier";
          };

          // !main
          RPH.draw = function() {
            RPH.pen.clear();

            RPH.ctx.textAlign = "center";
            RPH.ctx.textBaseline = "middle";

            RPH.phone.drawRing();
            RPH.phone.drawLine();
            RPH.phone.drawNumber();
            RPH.phone.drawDigits();

            if (RPH.phone.alpha > 0 && !RPH.mouse.isDragging) {
              RPH.phone.alpha -= 0.02;
            }

            RPH.canvas.addEventListener("mousedown", RPH.mouseDown);
            RPH.canvas.addEventListener("mousemove", RPH.mouseMove);
            RPH.canvas.addEventListener("mouseup", RPH.mouseUp);
          };

          function touchHandler(event) {
            var touch = event.changedTouches[0],
              simulatedEvent = document.createEvent("MouseEvent");

            simulatedEvent.initMouseEvent(
              {
                touchstart: "mousedown",
                touchmove: "mousemove",
                touchend: "mouseup"
              }[event.type],
              true,
              true,
              window,
              1,
              touch.screenX,
              touch.screenY,
              touch.clientX,
              touch.clientY,
              false,
              false,
              false,
              false,
              0,
              null
            );

            touch.target.dispatchEvent(simulatedEvent);
            event.preventDefault();
          }

          RPH.init = function() {
            document.addEventListener("touchstart", touchHandler, true);
            document.addEventListener("touchmove", touchHandler, true);
            document.addEventListener("touchend", touchHandler, true);
            document.addEventListener("touchcancel", touchHandler, true);

            RPH.canvas = document.getElementById("retrophone");
            RPH.ctx = RPH.canvas.getContext("2d");

            this.resizeCanvas();
            return setInterval(RPH.draw, 10);
          };

          RPH.resizeCanvas = function() {
            RPH.canvas.width = window.innerWidth;
            RPH.canvas.height = window.innerHeight;
            RPH.W = RPH.canvas.width;
            RPH.H = RPH.canvas.height;
            RPH.minWH = Math.min(RPH.W, RPH.H);
          };

          RPH.init();

          window.addEventListener("resize", RPH.resizeCanvas, false);
        } else if (items["input_phone_number_level"] == 3) {
          // pi
          $('input[type="number"]')
            .attr("disabled", "disabled")
            .attr("type", "text")
            .css("border", "none")
            .css("font-size", "large")
            .addClass("numinput")
            .val(0).after(`<br/><button onclick="prevDigit()">prev</button> 
            <button onclick="nextDigit()">next</button><br /> <br />
            <div class="pi" style="font-size: large; word-wrap: break-word; width: 90vw; margin: auto;"></div>`);
          document.addEventListener("copy", function(e) {
            navigator.clipboard
              .readText()
              .then(text => {
                $(".numinput").val(
                  text.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3")
                );
              })
              .catch(err => {
                console.error(err);
              });
          });

          $(".pi").mouseup(function() {
            document.execCommand("copy");
          });

          $.get(
            "https://api.pi.delivery/v1/pi",
            {
              start: 0,
              numberOfDigits: 1000
            },
            data => {
              $(".pi").text(data.content);
            }
          );
        } else if (items["input_phone_number_level"] == 4) {
          // tetris
          $('input[type="number"]')
            .attr("disabled", "disabled")
            .attr("type", "text")
            .css("border", "none")
            .css("font-size", "40px")
            .addClass("numinput")
            .val(0)
            .after(
              `<br/><canvas width=300 height=600 id='tetriscan'></canvas>`
            );
          $(".numinput").val("");
          setTimeout(() => {
            canv = document.getElementById("tetriscan");
            ctx = canv.getContext("2d");
            tw = 10;
            th = 20;
            cc = 30;
            x = 3;
            y = -1;
            tm = 0;
            dwn = 0;
            cell = [];
            reset = () => {
              for (r = 0; r < th; r++) {
                cell[r] = [];
                for (c = 0; c < tw; c++) {
                  cell[r][c] = 0;
                }
              }
            };
            reset();
            shape = [
              "00000111",
              "00000111",
              "00010111",
              "00010111",
              "01000111",
              "01000111",
              "00000001",
              "00000001"
            ];
            numbers = [
              "111101101101111",
              "001001001001001",
              "111001111100111",
              "111001111001111",
              "101101111001001",
              "111100111001111",
              "111100111101111",
              "111001001001001",
              "111101111101111",
              "111101111001111"
            ];
            function gen() {
              return "0000" + shape[Math.floor(Math.random() * 7)] + "0000";
            }
            csh = gen();
            function dr(type, row) {
              for (r = 0; r < th; r++) {
                cnt = 0;
                for (c = 0; c < tw; c++) {
                  ctx.fillStyle = "#ddd";
                  if (cell[r][c]) {
                    ctx.fillStyle = "#000";
                    cnt++;
                  }
                  ctx.fillRect(c * cc, r * cc, cc - 1, cc - 1);
                  if (type == 2 && th - r < row + 1)
                    cell[th - r][c] = cell[th - r - 1][c];
                }
                if (cnt == tw) {
                  for (c = 0; c < tw; c++) cell[r][c] = 0;
                  dr(2, r);
                }
              }
            }
            function chk(type, n = 0) {
              out = "";
              fnd = 0;
              for (r = 0; r < 4; r++)
                for (c = 0; c < 4; c++) {
                  if (csh[c + r * 4] == 1) {
                    if (type == 1) {
                      ctx.fillStyle = "#000";
                      ctx.fillRect(
                        c * cc + x * cc,
                        r * cc + y * cc,
                        cc - 1,
                        cc - 1
                      );
                    }
                    if (type == 2)
                      if (r + y > th - 2 || cell[r + y + 1][c + x] == 1) {
                        chk(3);
                        csh = gen();
                        x = 3;
                        y = -1;
                        dwn = 0;
                      }
                    if (type == 3) cell[r + y][c + x] = 1;
                    if (type == 5)
                      if ((c + x > tw - 2 && n == 1) || (c + x < 1 && n == -1))
                        fnd = 1;
                  }
                  if (type == 4) out += csh[r + (3 - c) * 4];
                }
              csh = type == 4 ? out : csh;
              if (!fnd) x += n;
            }
            rnCheck = 0;
            function game() {
              if (rnCheck >= 2) {
                rnCheck = 0;
              } else {
                rnCheck++;
              }
              // rnCheck = Math.floor(Math.random() * 7);
              checkingNum = cell[15]
                .slice(rnCheck * 3, rnCheck * 3 + 3)
                .concat(cell[16].slice(rnCheck * 3, rnCheck * 3 + 3))
                .concat(cell[17].slice(rnCheck * 3, rnCheck * 3 + 3))
                .concat(cell[18].slice(rnCheck * 3, rnCheck * 3 + 3))
                .concat(cell[19].slice(rnCheck * 3, rnCheck * 3 + 3));
              for (i = 0; i < numbers.length; i++) {
                if (
                  JSON.stringify(checkingNum) ===
                  JSON.stringify(numbers[i].split("").map(Number))
                ) {
                  console.log(i);
                  $(".numinput").val($(".numinput").val() + i);
                  reset();
                }
              }
              tm++;
              if (tm > 20 || dwn) {
                y++;
                tm = 0;
                chk(2);
              }
              dr(1, 0);
              chk(1);
            }
            setInterval(game, 33);
            function trigger(evt) {
              switch (evt.keyCode) {
                case 37:
                  chk(5, -1);
                  break;
                case 38:
                  chk(4);
                  break;
                case 39:
                  chk(5, 1);
                  break;
                case 40:
                  dwn = 1;
                  break;
                case 82:
                  reset();
                  break;
              }
            }
            document.addEventListener("keydown", trigger);
          }, 2000);
        } else if (items["input_phone_number_level"] == 5) {
          // camera
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
