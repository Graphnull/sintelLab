let fs = require('fs')
let tf = require('@tensorflow/tfjs-core')
let { Image } = require('./image')
//let { GPU, input } = require('gpu.js');
//let gpu = new GPU({});

Math.clamp = (v, min, max) => Math.max(Math.min(v, max), min)


let simpleResize =(data, w, h, nw, nh) => {
  let c = data.length / (w * h);
  return tf.tidy(() => {
    let t = tf.tensor(new Float32Array(data), [h, w, c])
    return t.resizeBilinear([nh, nw]).dataSync();
  })
}

let resize = (data, w, h, nw, nh) => {
  let c = data.length / (w * h);
  let kw = Math.floor(w / nw);
  let kh = Math.floor(h / nh);
  let ow = kw * nw
  let oh = kh * nh;
  let out = new Float32Array(nw * nh * c)
  tf.tidy(() => {
    let t = tf.tensor(data, [h, w, c])
    let resized = t.resizeBilinear([oh, ow]).dataSync();

    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {

        for (let dy = 0; dy < kh; dy++) {
          for (let dx = 0; dx < kw; dx++) {

            for (let ch = 0; ch < c; ch++) {
              out[y * nw * c + x * c + ch] += resized[(y * ow * kh + dy * ow + x * kw + dx) * c + ch] / (kh * kw);

            }

          }
        }

      }
    }
  })
  return out;
}

let scale = 1;
let ks = 9;
let wRaw = 1024;
let hRaw = 436;
let wOrig = Math.floor(wRaw / scale / ks) * ks * scale;
let hOrig = Math.floor(hRaw / scale / ks) * ks * scale;
let w = Math.floor(wOrig / scale);
let h = Math.floor(hOrig / scale);
let nw = Math.floor(w)
let nh = Math.floor(h)


let contexts = {}
let contextsGPU = {}
/*
let computeVectorGPU = (inputVecImage, im1, im2, nw, nh, ks, k = 1) => {

  let outW = Math.floor((nw - ks - ks) / ks)
  let outH = Math.floor((nh - ks - ks) / ks)

  let kshalf = Math.floor(ks / 2)
  if (!contextsGPU[nw + '_' + nh + '_' + ks]) {
    let time = new Date();
    let func = new Function('inputVecImage', 'im1', 'im2', `
      let x = this.thread.x;
      let y = this.thread.y;
      let minV = 0xfffff|0;
      let minI = 0;
      let inpx = Math.round((((x + 1) * ${ks}) / ${nw}) * ${inputVecImage.width});
      let inpy = Math.round((((y + 1) * ${ks}) / ${nh}) * ${inputVecImage.height});
      let diffx = inputVecImage[inpy][inpx*2+0]
      let diffy = inputVecImage[inpy][inpx*2+1]
      diffx = Math.round(diffx)
      diffy = Math.round(diffy)
      for (let ky = 0; ky < ${ks}; ky++) {
        for (let kx = 0; kx < ${ks}; kx++) {
          let diff = 0;
          //Сравниваем пиксели у изображений
          
          for (let dy = 0; dy < ${ks}; dy++) {
            ${(() => {
        let out = []
        for (let dx = 0; dx < ks; dx++) {
          out.push(`
                diff += Math.abs(im1[dy + (y + 1) * ${ks}][(${dx} + (x + 1) * ${ks})*4+0 ] - im2[dy - ${kshalf} + ky + (y + 1) * ${ks} + diffy][(${dx} - ${kshalf} + kx + (x + 1) * ${ks} + diffx)*4+0])
                + Math.abs(im1[dy + (y + 1) * ${ks}][(${dx} + (x + 1) * ${ks})*4+1 ] - im2[dy - ${kshalf} + ky + (y + 1) * ${ks} + diffy][(${dx} - ${kshalf} + kx + (x + 1) * ${ks} + diffx)*4+1])
                + Math.abs(im1[dy+ (y + 1) * ${ks}][(${dx} + (x + 1) * ${ks})*4+2 ] - im2[dy - ${kshalf} + ky + (y + 1) * ${ks} + diffy][(${dx} - ${kshalf} + kx + (x + 1) * ${ks} + diffx)*4+2])
              `)
        }
        return out.join('\n')
      })()}
          }
            
          if (diff < minV) {
            minV = diff;
            minI = ky * ${ks} + kx
          }
        }
      }
      return [((minI % ${ks}) - ${kshalf} ) + diffx, ((Math.floor(minI / ${ks})) - ${kshalf} ) + diffy]
    `);

    contextsGPU[nw + '_' + nh + '_' + ks] = gpu.createKernel(func, {
      //precision:'unsigned',
    }).setOutput([outW, outH])
      .setPipeline(true)

  }


  let out = contextsGPU[nw + '_' + nh + '_' + ks](input(inputVecImage.data, [inputVecImage.width * 2, inputVecImage.height]), input(im1, [nw * 4, nh]), input(im2, [nw * 4, nh]))

  out = out.renderRawOutput()
  let res = new Image(new Int32Array(outW * outH * 2), outW, outH)
  for (let i = 0; i !== outW * outH; i++) {
    res.data[i * 2 + 0] = out[i * 4 + 0]
    res.data[i * 2 + 1] = out[i * 4 + 1]
  }

  return res;

}*/
/*let computeVectorWebGL = (inputVecImage, im1, im2, nw, nh, ks, k = 1) => {
  let kshalf = Math.floor(ks / 2)
  let outW = Math.floor((nw - ks - ks) / ks)
  let outH = Math.floor((nh - ks - ks) / ks)


  if (!contexts[outW + '_' + outH]) {
    const multiplyMatrix = gpu.createKernel(function (a) {

      return [a, 1, 1, 1];
    }, {
      output: [outW, outH],
    }).setPipeline(true);


    console.log('multiplyMatrix.gpu: ', multiplyMatrix(1));

    contexts[outW + '_' + outH] = multiplyMatrix.gpu.context;
    //multiplyMatrix.gpu.canvas.width=22

    let gl = contexts[outW + '_' + outH]

    // gl.viewport(  0,
    //   0,
    //   outW, outH);
    // gl.drawingBufferWidth=outW;
    // gl.drawingBufferHeight=outH;
    console.log(gl.getParameter(gl.VIEWPORT), gl.drawingBufferWidth, gl.drawingBufferHeight);
    const vsSource = `
    attribute vec4 aVertexPosition;
    varying vec2 pos;
    void main() {
      pos = aVertexPosition.xy*0.5+0.5;
      gl_Position = aVertexPosition;
    }
  `;
    const fsSource = `
  precision highp float;
  varying vec2 pos;
  uniform sampler2D back;
  // uniform sampler2D img1;
  // uniform sampler2D img2;
  void main() {
    gl_FragColor = vec4(texture2D(back, pos).xxx,  pos.x);
  }`;
    function initShaderProgram(gl, vsSource, fsSource) {
      const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
      const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
      const shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);
      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        process.exit(1);
      }
      return shaderProgram;
    }
    function loadShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        process.exit(1);
      }
      return shader;
    }
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    let vertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');

    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1.0, 1.0,
      1.0, 1.0,
      -1.0, -1.0,
      1.0, -1.0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);



    contexts[outW + '_' + outH].draw = function drawScene(img, im1, im2, nw, nh) {
      //img=img.resize(128,128)
      gl.activeTexture(gl.TEXTURE0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      img.data[0] = 11;
      img.data[1] = 22;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(img.data));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      let usampleLoc = gl.getUniformLocation(shaderProgram, 'back')
      gl.uniform1i(usampleLoc, 0);


      // gl.activeTexture(gl.TEXTURE1);
      // const img1 = gl.createTexture();
      // gl.bindTexture(gl.TEXTURE_2D, img1);
      // // //im1 = (new Image(im1, nw,nh)).resize(128,128).data
      // // im1[0] = 33
      // // im1[1] = 44;
      // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, nw, nh, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(im1));
      // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      // gl.generateMipmap(gl.TEXTURE_2D);
      // let img1Loc = gl.getUniformLocation(shaderProgram, 'img1')
      // gl.uniform1i(img1Loc, 1);



      // console.log(gl.TEXTURE2);
      //   gl.activeTexture(gl.TEXTURE2);
      //       const img2 = gl.createTexture();
      //       gl.bindTexture(gl.TEXTURE_2D, img2);
      //       im2[0] = 33
      //       im2[1] = 44;
      //       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      //       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      //       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      //       gl.generateMipmap(gl.TEXTURE_2D);
      //       let img2Loc = gl.getUniformLocation(shaderProgram, 'img2')
      //       gl.uniform1i(img2Loc, 1);
      //       gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, nw, nh, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(im2));

      let error = gl.getError();
      if (error) {
        console.error(error)
        process.exit(1)
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(vertexPosition);
      gl.useProgram(shaderProgram);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    }


  }
  let gl = contexts[outW + '_' + outH]

  gl.draw(inputVecImage, im1, im2, nw, nh);

  var pixels = new Uint8Array(outW * outH * 4)
  gl.readPixels(0, 0, outW, outH, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  console.log(pixels);
  process.exit(1)
}*/
let computeVectorCPU = (inputVecImage, im1, im2, nw, nh, ks) => {
  let kshalf = Math.floor(ks / 2)
  let outW = Math.floor((nw) / ks)
  let outH = Math.floor((nh) / ks)

  let out = new Int16Array(outW * outH * 3)

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {

      let minV = 0xfffff;
      let minI = 0;
      //Переделать как в gpu варианте
      let diffx = inputVecImage.data[(y * outW + x) * inputVecImage.channels + 0]
      let diffy = inputVecImage.data[(y * outW + x) * inputVecImage.channels + 1]
      let lastMin = inputVecImage.data[(y * outW + x) * inputVecImage.channels + 2]
      diffx = Math.round(diffx);
      diffy = Math.round(diffy);

      for (let ky = 0; ky < ks; ky++) {
        for (let kx = 0; kx < ks; kx++) {

          let diff = 0;
          //Сравниваем пиксели у изображений
          for (let dy = 0; dy < ks; dy++) {
            for (let dx = 0; dx < ks; dx++) {
              diff += Math.abs(im1[((dy + y * ks) * nw + (dx + x * ks)) * 4 + 0] - im2[((dy - kshalf + ky + y * ks + diffy) * nw + (dx - kshalf + kx + x * ks + diffx)) * 4 + 0])

              diff += Math.abs(im1[((dy + y * ks) * nw + (dx + x * ks)) * 4 + 1] - im2[((dy - kshalf + ky + y * ks + diffy) * nw + (dx - kshalf + kx + x * ks + diffx)) * 4 + 1])

              diff += Math.abs(im1[((dy + y * ks) * nw + (dx + x * ks)) * 4 + 2] - im2[((dy - kshalf + ky + y * ks + diffy) * nw + (dx - kshalf + kx + x * ks + diffx)) * 4 + 2])

            }
          }
          if (diff < minV) {
            minV = diff;
            minI = ky * ks + kx
          }

        }
      }
      minV = minV / (ks * ks)

      if (lastMin< minV) {
        out[y * outW * 3 + x * 3 + 0] = diffx
        out[y * outW * 3 + x * 3 + 1] = diffy
        out[y * outW * 3 + x * 3 + 2] = lastMin;
      } else {
        out[y * outW * 3 + x * 3 + 0] = ((minI % ks) - kshalf) + diffx
        out[y * outW * 3 + x * 3 + 1] = ((Math.floor(minI / ks)) - kshalf) + diffy
        out[y * outW * 3 + x * 3 + 2] = minV;
      }


    }
  }
  return new Image(out, outW, outH);
}

let getDiff = (im1, im2,w,h, ks) => {
  let kshalf = Math.floor(ks / 2)

  let minV = 0xfffff;
  let minI = 0;
  for (let y = 0; y < ks; y++) {
    for (let x = 0; x < ks; x++) {

      let diff = 0;
      //Сравниваем пиксели у изображений
      for (let dy = 0; dy < h-ks; dy++) {
        for (let dx = 0; dx < w-ks; dx++) {
          diff += Math.abs(im1[((dy + kshalf) * w + dx + kshalf) * 4 + 0] - im2[((dy + y) * w + (dx + x)) * 4 + 0])

          diff += Math.abs(im1[((dy + kshalf) * w + dx + kshalf) * 4 + 1] - im2[((dy + y) * w + (dx + x)) * 4 + 1])

          diff += Math.abs(im1[((dy + kshalf) * w + dx + kshalf) * 4 + 2] - im2[((dy + y) * w + (dx + x)) * 4 + 2])

        }
      }
      if (diff < minV) {
        minV = diff;
        minI = y * ks + x
      }

    }
  }
  minV = minV / ((w-ks) * (h-ks))
  
  return new Image([(minI % ks) - kshalf, (Math.floor(minI / ks)) - kshalf, minV], 1, 1);
}
let computeVector = computeVectorCPU
let getBaseShift = (im1, im2, w, h, ks) => {
  return getDiff(im1, im2, w, h, ks);
  let diff = new Image(im2, w, h).convDist(new Image(im1, w, h).extract(Math.floor(ks / 2), Math.floor(ks / 2), w - ks, h - ks));

  let minV = Infinity;
  let minI = 0;
  diff.data.forEach((v, i) => { if (v < minV) { minV = v; minI = i } })

  let kshalf = Math.floor(ks / 2)
  let diffx = (minI % ks) - kshalf
  let diffy = (Math.floor(minI / ks)) - kshalf
  return new Image([diffx, diffy, minV], 1, 1)
}
module.exports.getBaseShift = getBaseShift;
module.exports.resize = resize;
module.exports.computeVector = computeVector;
