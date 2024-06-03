import { useState, useEffect, useRef } from "react";
import "./App.css";
import img1 from "./assets/img1.jpg";
import img2 from "./assets/img2.jpg";
import img3 from "./assets/img3.jpg";
import ashurov from "./assets/ashurov.jpeg";
import * as faceapi from "face-api.js";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const imagesBoxRef = useRef(null);
  const buttonRef = useRef(null);
  const loadModels = () => {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
    ]).then(() => {
      faceMyDetect();
    });
  };

  function loadLabeledImages() {
    const labels = ["Ашуров"];
    return Promise.all(
      labels.map(async (label) => {
        const descriptions = [];
        const img = await faceapi.fetchImage(ashurov);
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);

        return new faceapi.LabeledFaceDescriptors(label, descriptions);
      })
    );
  }

  const faceMyDetect = () => {
    setInterval(async () => {
      const labeledFaceDescriptors = await loadLabeledImages();
      const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

      const detections = await faceapi
        .detectAllFaces(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptors();

      // Получаем контекст для рисования на холсте
      const textCtx = canvasRef.current.getContext("2d");

      // Очищаем холст перед каждым новым отрисовкой
      textCtx.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      // Проверяем, были ли обнаружены лица
      if (detections.length) {
        // Устанавливаем шрифт и цвет текста
        textCtx.font = "60px Arial";
        textCtx.fillStyle = "red";

        // Рисуем текст "Пользователь обнаружен"
        // textCtx.fillText("Пользователь обнаружен", 10, 50);
      }

      const displaySize = { width: 2000, height: 2000 };
      faceapi.matchDimensions(canvasRef, displaySize);
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const results = resizedDetections.map((d) =>
        faceMatcher.findBestMatch(d.descriptor)
      );

      // results.forEach((result, i) => {
      //   const box = resizedDetections[i].detection.box;
      //   const drawBox = new faceapi.draw.DrawBox(box, {
      //     label: result.toString(),
      //   });
      //   drawBox.draw(canvasRef.current);
      // });

      results.forEach((result, i) => {
        const box = resizedDetections[i].detection.box;

        // Изменяем координаты x и y для смещения позиции box
        const offsetX = -250; // Смещение по оси X, чтобы текст начинался слегка левее центра лица
        const offsetY = -250; // Смещение по оси Y, увеличиваем для размещения текста над лицом

        // Создаем новый прямоугольник с измененными координатами
        const shiftedBox = new faceapi.Rect(
          box.x + offsetX,
          box.y + offsetY,
          box.width,
          box.height
        );

        const drawBox = new faceapi.draw.DrawBox(shiftedBox, {
          label: result.toString(),
        });
        // drawBox.draw(canvasRef.current);

        // Добавляем текст над прямоугольником
        const textCtx = canvasRef.current.getContext("2d");
        textCtx.font = "50px Arial"; // Установите размер шрифта и семейство шрифтов по своему усмотрению
        textCtx.fillStyle = "red"; // Выберите цвет текста, который хорошо виден на фоне
        textCtx.fillText(result.label, shiftedBox.x + 10, shiftedBox.y + 10); // Расположение текста внутри прямоугольника
      });
    }, 500);
  };

  let img$ = null;
  useEffect(() => {
    // startVideo();
    videoRef && loadModels();
  }, []);

  useEffect(() => {
    const video$ = videoRef.current;
    const canvas$ = canvasRef.current;
    const ctx = canvas$.getContext("2d");
    const imagesBox$ = imagesBoxRef.current;
    const button$ = buttonRef.current;

    const onImagesBoxClick = (e) => {
      const newSelectedImage =
        e.target.localeName === "img" ? e.target : e.target.closest("img");
      if (!newSelectedImage) return;

      const prevSelectedImage = imagesBox$.querySelector(".selected");
      if (prevSelectedImage) {
        prevSelectedImage.classList.remove("selected");
      }

      newSelectedImage.classList.add("selected");
      img$ = newSelectedImage;
    };

    const onButtonClick = () => {
      img$ = null;

      ctx.clearRect(0, 0, canvas$.width, canvas$.height);

      const selectedImage = imagesBox$.querySelector(".selected");
      if (selectedImage) {
        selectedImage.classList.remove("selected");
      }
    };

    imagesBox$.addEventListener("click", onImagesBoxClick);
    button$.addEventListener("click", onButtonClick);

    // const WIDTH = (canvas$.width = window.innerWidth);
    // const HEIGHT = (canvas$.height = window.innerHeight);
    const WIDTH = (canvas$.width = window.innerWidth);
    const HEIGHT = (canvas$.height = window.innerHeight);

    function onResults(results) {
      if (!img$) return;

      ctx.save();

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      ctx.drawImage(results.segmentationMask, 0, 0, WIDTH, HEIGHT);

      ctx.globalCompositeOperation = "source-out";
      ctx.drawImage(img$, 0, 0, WIDTH, HEIGHT);

      ctx.globalCompositeOperation = "destination-atop";
      ctx.drawImage(results.image, 0, 0, WIDTH, HEIGHT);

      ctx.restore();
    }

    const selfieSegmentation = new SelfieSegmentation({
      locateFile: (file) =>
        // `./node_modules/@mediapipe/selfie_segmentation/${file}`,
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    selfieSegmentation.setOptions({
      modelSelection: 1,
    });
    selfieSegmentation.onResults(onResults);

    const camera = new Camera(video$, {
      onFrame: async () => {
        await selfieSegmentation.send({ image: video$ });
      },
      facingMode: undefined,
      width: WIDTH,
      height: HEIGHT,
    });
    camera.start();
  }, []);

  return (
    <>
      <video ref={videoRef}></video>
      <canvas ref={canvasRef}></canvas>
      <div ref={imagesBoxRef} className="images-box">
        <img src={img1} alt="" />
        <img src={img2} alt="" />
        <img src={img3} alt="" />
      </div>
      <button ref={buttonRef}>Настоящий фон</button>
      <script type="module" src="/selfie_segmentation.js"></script>
    </>
  );
}

export default App;
