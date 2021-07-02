Math.sum = (args) => {
    let out = 0;
    args.forEach(v => {
        out += v
    })
    return out;
}
Math.clamp = (value, min, max) => Math.max(Math.min(max, value), min)


class Image {
    constructor(img, inwidth, inheight, channels) {

        this.data = img
        this.width = inwidth;
        this.height = inheight;
        if(channels){
        this.channels = channels || 3
        }else{
            this.channels = img.length/(inwidth*inheight)
        }
        //this.data= new Uint8Array(imgOrWidth*height*3);
    }
    for(func, params = {}) {
        let { offsetx, offsety, cw, ch, step } = params;
        offsety = offsety || 0;
        offsetx = offsetx || 0;
        step = step || 1
        for (let y = offsety; y < (ch || this.height) + offsety; y += step) {
            for (let x = offsetx; x < (cw || this.width) + offsetx; x += step) {
                let i = y * this.width * this.channels + x * this.channels
                func(i, this.data, x, y)
            }
        }
        return this;
    }
    clamp(min, max) {
        this.for((i, data) => {
            for (let c = 0; c !== this.channels; c++) {
                data[i + c] = Math.clamp(data[i + c], min, max);
            }
        })
        return this;
    }
    convSame(img) {
        if (img.channels !== this.channels) {
            throw new Error('img.channels!==this.channels')
        }
        let ksw = img.width;
        let ksh = img.height
        let w = this.width;
        let h = this.height;
        let out = (new Float32Array(w * h));
        for (let y = (ksh / 2) | 0; y < (h - (ksh / 2) | 0); y++) {
            for (let x = (ksw / 2) | 0; x < (w - (ksh / 2) | 0); x++) {
                let dist = 0;
                img.for((i, data, px, py) => {

                    for (let c = 0; c !== this.channels; c++) {
                        dist += (data[i + c] * this.data[(y + py) * w * this.channels + (x + px) * this.channels + c]);
                    }

                })
                out[y * w + x] = dist / (img.width * img.height * img.channels)
            }
        }
        return new Image(out, w, h, 1)
    }
    conv(img, offset = {}) {
        if (img.channels !== this.channels) {
            throw new Error('img.channels!==this.channels')
        }
        let startx = offset.x || 0;
        let starty = offset.y || 0;
        let width = offset.width || (this.width - img.width + 1);
        let height = offset.height || (this.height - img.height + 1);
        if ((width + startx) > (this.width - img.width + 1) || (height + starty) > (this.height - img.height + 1)) {
            throw new Error('sss')
        }

        let out = (new Float32Array(width * height));
        for (let y = starty; y < (height + starty); y++) {
            for (let x = startx; x < (width + startx); x++) {
                let dist = 0;
                img.for((i, data, px, py) => {

                    for (let c = 0; c !== this.channels; c++) {
                        dist += (data[i + c] * this.data[(y + py) * this.width * this.channels + (x + px) * this.channels + c]);
                    }

                })
                out[(y - starty) * width + (x - startx)] = dist / (img.width * img.height * img.channels)
                //console.log(out[(y - starty) * width + (x - startx)]);
            }
        }
        return new Image(out, width, height, 1)
    }
    toChannels(nc) {
        let data = new this.data.constructor(this.width * this.height * nc)

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                for (let c = 0; c !== nc; c++) {
                    data[y * this.width * nc + x * nc + c] = this.data[y * this.width + x];
                }
            }
        }
        return new Image(data, this.width, this.height, nc)
    }
    findLocalMin(second, ks, mask) {

        if (second.channels !== this.channels) {
            throw new Error('img.channels!==this.channels')
        }
        let img = second.extract(ks / 2, ks / 2, second.width - ks, second.height - ks)
        let startx = 0;
        let starty = 0;
        let width = (this.width - img.width);

        let height = (this.height - img.height);
        if ((width + startx) > (this.width - img.width) || (height + starty) > (this.height - img.height)) {
            throw new Error('sss')
        }

        let getDist = (x, y) => {
            if (mask) {
                let dist = 0;
                let count = 0;
                for (let py = 0; py < img.height; py++) {
                    for (let px = 0; px < img.width; px++) {
                        if (mask.data[(y + py) * this.width + (x + px)]) {
                            count++;
                            let data = img.data;
                            let i = py * img.width * img.channels + px * img.channels

                            for (let c = 0; c !== this.channels; c++) {
                                dist += Math.pow(data[i + c] - this.data[(y + py) * this.width * this.channels + (x + px) * this.channels + c], 2);
                            }
                        }

                    }
                }
                return Math.sqrt(dist) / (count * this.channels)
            }
            let dist = 0;
            for (let py = 0; py < img.height; py++) {
                for (let px = 0; px < img.width; px++) {

                    let data = img.data;
                    let i = py * img.width * img.channels + px * img.channels

                    for (let c = 0; c !== this.channels; c++) {
                        dist += Math.pow(data[i + c] - this.data[(y + py) * this.width * this.channels + (x + px) * this.channels + c], 2);
                    }


                }
            }
            return Math.sqrt(dist) / (img.width * img.height * img.channels)
        }

        let iters = Math.log2(width);
        let x = 0;
        let y = 0;
        iters--
        let w = Math.pow(2, iters);
        let h = Math.floor(w / 2)
        let d1 = Math.min(getDist(x + h, y + h), getDist(x + h + Math.floor(h / 2), y + h + Math.floor(h / 2)));
        let d2 = Math.min(getDist(x + h + w, y + h), getDist(x + h + w - Math.floor(h / 2), y + h + Math.floor(h / 2)));
        let d3 = Math.min(getDist(x + h, y + h + w), getDist(x + h + Math.floor(h / 2), y + h + w - Math.floor(h / 2)));
        let d4 = Math.min(getDist(x + h + w, y + h + w), getDist(x + h + w - Math.floor(h / 2), y + h + w - Math.floor(h / 2)));

        if (Math.min(d1, d2) <= Math.min(d3, d4)) {
                if (d1 >= d2) {
                    x += w
                }
        } else {
            y += w;
            if (d3 >= d4) {
                x += w
            }
        }

        while (iters--) {
            let w = Math.pow(2, iters);
            let h = Math.floor(w / 2)
            let d1 = getDist(x + h, y + h);
            let d2 = getDist(x + h + w, y + h);
            let d3 = getDist(x + h, y + h + w);
            let d4 = getDist(x + h + w, y + h + w);
            if (Math.min(d1, d2) <= Math.min(d3, d4)) {
                    if (d1 >= d2) {
                        x += w
                    }
            } else {
                y += w;
                if (d3 >= d4) {
                    x += w
                }
            }
        }

        // let out = (new Float32Array(width * height));
        // for (let y = starty; y < (height + starty); y++) {
        //     for (let x = startx; x < (width + startx); x++) {
        //         out[(y - starty) * width + (x - startx)] = getDist()
        //     }
        // }
        x -= width / 2;
        y -= width / 2;
        return [-x, -y]
    }
    convDist(img, offset = {}) {
        if (img.channels !== this.channels) {
            throw new Error('img.channels!==this.channels')
        }
        let startx = offset.x || 0;
        let starty = offset.y || 0;
        let width = offset.width || (this.width - img.width);
        let height = offset.height || (this.height - img.height);
        let step = offset.step || 1
        if ((width + startx) > (this.width - img.width) || (height + starty) > (this.height - img.height)) {
            throw new Error('sss')
        }

        let out = (new Float32Array(width * height));
        for (let y = starty; y < (height + starty); y++) {
            for (let x = startx; x < (width + startx); x++) {
                let dist = 0;

                for (let py = 0; py < img.height; py++) {
                    for (let px = 0; px < img.width; px++) {
                        let data = img.data;
                        let i = py * img.width * img.channels + px * img.channels

                        for (let c = 0; c !== this.channels; c++) {
                            dist += Math.pow(data[i + c] - this.data[(y + py) * this.width * this.channels + (x + px) * this.channels + c], 2);
                        }

                    }
                }

                out[(y - starty) * width + (x - startx)] = Math.sqrt(dist) / (img.width * img.height * img.channels)
                //console.log(out[(y - starty) * width + (x - startx)]);
            }
        }
        return new Image(out, width, height, 1)
    }
    conv2d(image1, convWidth, convStart, convOptions = {}, ox, oy) {
        let out = (new Array(convWidth * convWidth)).fill(0);
        for (let y = convStart; y < (convWidth + convStart); y++) {

            for (let x = convStart; x < (convWidth + convStart); x++) {
                let offset = (y + oy) * this.width * this.channels + (x + ox) * this.channels
                let dist = 0;
                let count = 0;
                this.for((i, data, px, py) => {
                    if (typeof image1.data[i + offset + 0] === 'number') {
                        count++;
                        dist += (
                            (data[i + 0] - image1.data[i + offset + 0]) ** 2 +
                            (data[i + 1] - image1.data[i + offset + 1]) ** 2 +
                            (data[i + 2] - image1.data[i + offset + 2]) ** 2
                        ) / (256 * 3);
                    }
                }, convOptions)
                out[(y - convStart) * convWidth + (x - convStart)] = Math.sqrt(dist) / count /// ((convOptions.cw || this.width) * (convOptions.ch || this.height))
            }
        }

        return new Image(out, convWidth, convWidth);
    }
    moveLinear(img) {

        let nImg = this.clone();
        for (let y = 0; y !== this.height; y++) {
            for (let x = 0; x !== this.width; x++) {

                let i = y * this.width * this.channels + x * this.channels
                let ii = y * img.width * img.channels + x * img.channels
                let xoffset = Math.round(img.data[ii + 0])
                let yoffset = Math.round(img.data[ii + 1])

                let val = this.value((x + xoffset) / this.width, (y + yoffset) / this.height, 'LINEAR')

                for (let c = 0; c !== this.channels; c++) {
                    nImg[i + c] = val[c];
                }
            }
        }
        this.data = nImg
        return this;
    }
    move(img, black) {
        let nImg = new Buffer(this.data.length)
        for (let y = 0; y !== this.height; y++) {
            for (let x = 0; x !== this.width; x++) {

                let i = y * this.width * this.channels + x * this.channels
                let ii = y * img.width * img.channels + x * img.channels
                let xoffset = Math.round(img.data[ii + 0])
                let yoffset = Math.round(img.data[ii + 1])
                //console.log(xoffset, yoffset);
                if (black && (xoffset + x > this.width || yoffset + y > this.height || xoffset + x < 0 || yoffset + y < 0)) {
                    continue;
                }
                for (let c = 0; c !== this.channels; c++) {
                    nImg[i + c] = this.data[i + c + yoffset * this.width * this.channels + xoffset * this.channels]
                }
            }
        }
        this.data = nImg
        return this;
    }
    value(xp, yp, type) {
        let x = (xp * (this.width - 1))// * (this.width / (this.width + 1));
        let y = (yp * (this.height - 1))// * (this.height / (this.height + 1));
        let out = new Array(this.channels)

        for (let c = 0; c < this.channels; c++) {
            if (type === 'LINEAR' && this.width > 1 && this.height > 1) {
                let ltx = this.data[Math.floor(y) * this.width * this.channels + Math.floor(x) * this.channels + c]
                let rtx = this.data[Math.floor(y) * this.width * this.channels + Math.ceil(x) * this.channels + c]
                let lbx = this.data[Math.ceil(y) * this.width * this.channels + Math.floor(x) * this.channels + c]
                let rbx = this.data[Math.ceil(y) * this.width * this.channels + Math.ceil(x) * this.channels + c];

                out[c] = (ltx * (1 - (x % 1)) + rtx * (x % 1)) * (1 - (y % 1)) + (lbx * (1 - (x % 1)) + rbx * (x % 1)) * (y % 1);
            } else {
                out[c] = this.data[Math.floor(y) * this.width * this.channels + Math.floor(x) * this.channels + c];
            }
        }
        return out;
    }
    minPoint(min) {
        let minV = Math.min(...this.data);
        let avgx = 0;
        let avgy = 0;
        let count = 0;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let i = x + y * this.width;
                let n = this.data[i];
                if (n === minV) {
                    avgx += (x + min)
                    avgy += (y + min)
                    count++;
                }
            }
        }

        avgx = -avgx / count;
        avgy = -avgy / count;
        return [avgx, avgy]
    }
    save(name) {
        let data = this.data;
        let channels = this.channels
        if (this.channels === 1) {
            data = new Buffer(this.width * this.height * 3);

            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    data[y * this.width * 3 + x * 3 + 0] = this.data[y * this.width * 1 + x * 1 + 0]// + 128
                    data[y * this.width * 3 + x * 3 + 1] = this.data[y * this.width * 1 + x * 1 + 0]// + 128
                    data[y * this.width * 3 + x * 3 + 2] = this.data[y * this.width * 1 + x * 1 + 0]
                }
            }
            channels = 3
        }
        if (this.channels === 2) {
            data = new Buffer(this.width * this.height * 3);

            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    data[y * this.width * 3 + x * 3 + 0] = this.data[y * this.width * 2 + x * 2 + 0]// + 128
                    data[y * this.width * 3 + x * 3 + 1] = this.data[y * this.width * 2 + x * 2 + 1]// + 128
                    data[y * this.width * 3 + x * 3 + 2] = 128
                }
            }
            channels = 3
        }
        if (this.channels > 4) {
            data = new Buffer(this.width * this.height * 3);

            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    data[y * this.width * 3 + x * 3 + 0] = this.data[y * this.width * this.channels + x * this.channels + 0]
                    data[y * this.width * 3 + x * 3 + 1] = this.data[y * this.width * this.channels + x * this.channels + 1]
                    data[y * this.width * 3 + x * 3 + 2] = this.data[y * this.width * this.channels + x * this.channels + 2]
                }
            }
            channels = 3
        }
        if (data instanceof Float32Array || data instanceof Float64Array || data instanceof Int32Array || data instanceof Uint32Array || data instanceof Uint8Array) {
            data = new Buffer(data.length).map((v, i) => data[i])
        }
        try{
        let sharp = require('sharp');
        return sharp(data, { raw: { width: this.width, height: this.height, channels } }).png().toFile(name)
        }catch(err){
            let jimp = require('jimp')

            let image = new jimp(this.width,this.height);
            for(let y =0;y!==this.height;y++){
                for(let x =0;x!==this.width;x++){
                    for(let c =0;c!==channels;c++){
                        image.bitmap.data[(y*this.width+x)*4+c] = Math.clamp(data[(y*this.width+x)*channels+c],0,255)
                    }
                    if(channels<4){
                        image.bitmap.data[(y*this.width+x)*4+3] = 255;
                    }
                }
            }
            return image.writeAsync(name)

        }
    }
    toFloat() {
        let out = new Float32Array(this.height * this.width * this.channels)
        for (let i = 0; i < this.height * this.width * this.channels; i++) {
            out[i] = this.data[i]
        }
        this.data = out;
        return this;
    }
    diff(img) {
        let out = this.clone()//new Buffer(this.width * this.height * this.channels);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                for (let c = 0; c < this.channels; c++) {
                    let pos = y * this.width * this.channels + x * this.channels + c
                    out.data[pos] = Math.abs(this.data[pos] - img.data[pos])
                }
            }
        }
        return out
    }

    clone() {

        return new Image(this.data.map(v => v), this.width, this.height, this.channels)
    }
    mul(value) {
        this.for((i, data) => {
            if (value instanceof Image) {
                for (let c = 0; c !== this.channels; c++) {
                    data[i + c] *= value.data[i + c];
                }
            } else {
                for (let c = 0; c !== this.channels; c++) {
                    data[i + c] *= value;
                }
            }
        })
        return this;
    }
    div(value) {
        this.for((i, data) => {
            if (value instanceof Image) {
                for (let c = 0; c !== this.channels; c++) {
                    data[i + c] /= value.data[i + c];
                }
            } else {
                for (let c = 0; c !== this.channels; c++) {
                    data[i + c] /= value;
                }
            }
        })
        return this;
    }
    fill(value) {
        this.for((i, data) => {
            for (let c = 0; c !== this.channels; c++) {
                data[i + c] = value;
            }
        })
        return this;
    }
    bin(value) {
        this.for((i, data) => {
            for (let c = 0; c !== this.channels; c++) {
                data[i + c] = data[i + c] > value ? 1 : 0;
            }
        })
        return this;
    }
    abs() {
        this.for((i, data) => {
            data[i] = Math.abs(data[i]);
        })
        return this;
    }
    inverse() {
        this.for((i, data) => {
            data[i] = -data[i];
        })
        return this;
    }
    pow(value) {
        this.for((i, data) => {
            data[i] = Math.pow(data[i], value);
        })
        return this;
    }
    add(value) {
        this.for((i, data) => {
            if (value instanceof Image) {
                for (let c = 0; c !== this.channels; c++) {
                    data[i + c] += value.data[i + c];
                }
            } else {
                for (let c = 0; c !== this.channels; c++) {
                    data[i + c] += value;
                }
            }
        })
        return this;
    }
    extract(x, y, width, height) {
        let data = new this.data.constructor(width * height * this.channels)
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {

                for (let c = 0; c < this.channels; c++) {

                    if ((dx + x) > this.width || (dy + y) > this.height || (dx + x) < 0 || (dy + y) < 0) {
                        data[dy * width * this.channels + dx * this.channels + c] = 0;
                    } else {
                        data[dy * width * this.channels + dx * this.channels + c] = this.data[(dy + y) * this.width * this.channels + (dx + x) * this.channels + c];
                    }
                }
            }
        }
        return new Image(data, width, height, this.channels)
    }
    edgeConv() {
        let kernel = new Float32Array([
            -1, -1, -1, -1, -1, -1, -1, -1, -1,
            -1, -1, -1, 8, 8, 8, -1, -1, -1,
            -1, -1, -1, -1, -1, -1, -1, -1, -1
        ])
        if (this.channels === 1) {
            kernel = new Float32Array([-1, -1, -1, -1, 8, -1, -1, -1, -1])
        }

        return this.convSame(new Image(kernel, 3, 3, this.channels))
    }
    edge(unabs) {
        let kernel = new Float32Array([
            -1, -1, -1, -1, -1, -1, -1, -1, -1,
            -1, -1, -1, 8, 8, 8, -1, -1, -1,
            -1, -1, -1, -1, -1, -1, -1, -1, -1
        ])
        if (this.channels === 1) {
            kernel = new Float32Array([-1, -1, -1, -1, 8, -1, -1, -1, -1])
        }

        return this.conv(new Image(kernel, 3, 3, this.channels)).for((i, data) => {
            if (!unabs) {
                data[i] = Math.abs(data[i]) * 2
            }
        })
        let img = this.extract(0, 0, this.width - 2, this.height - 2)
        return img.for((i, data, x, y) => {

            let pdx = (y + 1) * this.width * 3 + (x + 0) * 3;
            let pdy = (y + 0) * this.width * 3 + (x + 1) * 3;

            let pc = (y + 1) * this.width * 3 + (x + 1) * 3;

            let px = (y + 1) * this.width * 3 + (x + 2) * 3;
            let py = (y + 2) * this.width * 3 + (x + 1) * 3;

            data[i] = (
                Math.abs(this.data[pc] - this.data[px]) +
                Math.abs(this.data[pc + 1] - this.data[px + 1]) +
                Math.abs(this.data[pc + 2] - this.data[px + 2]) +
                Math.abs(this.data[pc] - this.data[py]) +
                Math.abs(this.data[pc + 1] - this.data[py + 1]) +
                Math.abs(this.data[pc + 2] - this.data[py + 2]) +
                Math.abs(this.data[pc] - this.data[pdx]) +
                Math.abs(this.data[pc + 1] - this.data[pdx + 1]) +
                Math.abs(this.data[pc + 2] - this.data[pdx + 2]) +
                Math.abs(this.data[pc] - this.data[pdy]) +
                Math.abs(this.data[pc + 1] - this.data[pdy + 1]) +
                Math.abs(this.data[pc + 2] - this.data[pdy + 2])
            ) / 12
            data[i + 1] = data[i]
            data[i + 2] = data[i]
        })
    }
    edge3x3() {
        let img = this.extract(1, 1, this.width - 2, this.height - 2)
        return img.for((i, data, x, y) => {

            let pdx = (y + 1) * this.width * this.channels + (x + 0) * this.channels;

            let pdy = (y + 0) * this.width * this.channels + (x + 1) * this.channels;

            let pc = (y + 1) * this.width * this.channels + (x + 1) * this.channels;

            let px = (y + 1) * this.width * this.channels + (x + 2) * this.channels;
            let py = (y + 2) * this.width * this.channels + (x + 1) * this.channels;
            let val = 0;
            for (let c = 0; c !== this.channels; c++) {
                val = (
                    Math.abs(this.data[pc + c] - this.data[pdx + c]) +
                    Math.abs(this.data[pc + c] - this.data[pdy + c]) +
                    Math.abs(this.data[pc + c] - this.data[px + c]) +
                    Math.abs(this.data[pc + c] - this.data[py + c])
                )
            }
            data[i] = val / (4 * this.channels)
            data[i + 1] = data[i]
            data[i + 2] = data[i]
        })
    }
    edge2x2() {
        let img = this.extract(0, 0, this.width - 1, this.height - 1)
        return img.for((i, data, x, y) => {

            let pdc = (y + 1) * this.width * this.channels + (x + 1) * this.channels;

            let pdy = (y + 0) * this.width * this.channels + (x + 1) * this.channels;

            let pc = (y + 0) * this.width * this.channels + (x + 0) * this.channels;

            let px = (y + 0) * this.width * this.channels + (x + 1) * this.channels;
            let py = (y + 1) * this.width * this.channels + (x + 0) * this.channels;
            let val = 0;
            for (let c = 0; c !== this.channels; c++) {
                val = (
                    Math.abs(this.data[pc + c] - this.data[px + c]) +
                    Math.abs(this.data[pc + c] - this.data[py + c]) +
                    Math.abs(this.data[pc + c] - this.data[pdc + c])
                )
            }
            data[i] = val / (3 * this.channels)
            data[i + 1] = data[i]
            data[i + 2] = data[i]
        })
    }
    mirror() {
        return this.clone().for((i, data, x, y) => {
            for (let c = 0; c !== this.channels; c++) {
                //if (vert) {
                //    data[i + c] = this.data[(this.height - (y + 1)) * this.width * this.channels + x * this.channels + c]
                //} else {
                data[i + c] = this.data[(this.height - (y + 1)) * this.width * this.channels + (this.width - (x + 1)) * this.channels + c]
                //}
            }
        })
    }
    dist(image) {
        let dist = 0;
        this.for((i, data) => {
            for (let c = 0; c !== this.channels; c++) {
                dist += (data[i + c] - image.data[i + c]) ** 2
            }
        })
        return Math.sqrt(dist / (this.width * this.height * this.channels))
    }
    features(convw = 5) {
        let img = new Image(new Float32Array((this.width - convw) * (this.height - convw)), this.width - convw, this.height - convw, 1);
        this.for((i, data, x, y) => {
            let conv = this.extract(x, y, convw, convw);

            img.data[y * img.width + x] = conv.dist(conv.mirror())
        }, { cw: this.width - convw, ch: this.height - convw })
        return img;
    }
    grayscale() {
        let data = new this.data.constructor(this.width * this.height)
        for (let dy = 0; dy < this.height; dy++) {
            for (let dx = 0; dx < this.width; dx++) {
                data[dy * this.width + dx] = this.data[dy * this.width * this.channels + dx * this.channels];
            }
        }
        return new Image(data, this.width, this.height, 1)
    }
    resize(newWidth, newHeight) {
        let data = new this.data.constructor(newWidth * newHeight * this.channels)

        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                let val = this.value(x / newWidth, y / newHeight, 'LINEAR')
                //console.log('val: ', val);
                for (let c = 0; c !== this.channels; c++) {
                    data[y * newWidth * this.channels + x * this.channels + c] = val[c];
                }
            }
        }
        return new Image(data, newWidth, newHeight, this.channels)
    }
    getMaxPoint() {
        let maxV = -Infinity;
        let maxI = 0;
        for (let i = 0; i !== this.data.length; i++) {
            if (this.data[i] > maxV) {
                maxV = this.data[i];
                maxI = i;
            }
        }
        let cx = maxI % this.width;
        let cy = Math.floor(maxI / this.width)
        return [cx, cy]
    }
    getMinPoint() {
        let minV = Infinity;
        let minI = 0;
        for (let i = 0; i !== this.data.length; i++) {
            if (this.data[i] < minV) {
                minV = this.data[i];
                minI = i;
            }
        }
        let cx = minI % this.width;
        let cy = Math.floor(minI / this.width)
        return [cx, cy, minV]
    }
}
class MotionImage {
    constructor(mWidth, mHeight) {
        this.points = [];
        this.mx = mWidth;
        this.my = mHeight;
    }
    push(value) {
        this.points.push(value)
    }

    getImage(pscale) {
        let scale = 1;
        let [centerx, centery, maxx, maxy, koefs, dist] = this.getParams()
        let img = new Image(new Float32Array([centerx, centery, koefs, dist]), 1, 1, 4);
        scale *= 2;
        for (; scale < pscale; scale *= 2) {
            let upscaleImg = new Image(new Float32Array(img.width * img.height * img.channels * 4), img.width * 2, img.height * 2, img.channels);
            this.points.forEach(p => {
                let k = 100 - p[4]

                let x = Math.floor((p[0] / this.mx) * scale);
                let y = Math.floor((p[1] / this.my) * scale);
                //console.log('xy', x, y);
                let i = y * scale * upscaleImg.channels + x * upscaleImg.channels
                upscaleImg.data[i + 0] += (p[0] - p[2]) * k
                upscaleImg.data[i + 1] += (p[1] - p[3]) * k
                upscaleImg.data[i + 2] += k
                upscaleImg.data[i + 3] += p[4]
                //centerx += (p[0] - p[2]) * k
                //centery += (p[1] - p[3]) * k
                //maxx = Math.max(maxx, (p[0] - p[2]));
                //maxy = Math.max(maxy, (p[1] - p[3]));
                //koefs += k
            })

            upscaleImg.for((i, data, x, y) => {
                if (data[i + 2]) {
                    data[i + 0] = data[i + 0] / data[i + 2]
                    data[i + 1] = data[i + 1] / data[i + 2]
                    data[i + 3] = data[i + 3] / this.points.length
                } else {
                    let val = img.value(x / upscaleImg.width, y / upscaleImg.height, 'LINEAR');
                    data[i + 0] = val[0];
                    data[i + 1] = val[1];
                    data[i + 2] = val[2];
                    data[i + 3] = val[3];
                }
            })
            //console.log('upscaleImg', upscaleImg.data);
            img = upscaleImg;
        }
        //console.log(img.data);
        return img;
    }
    getParams() {
        let centerx = 0;
        let centery = 0;
        let koefs = 0;
        let maxx = 0;
        let maxy = 0;
        let dist = 0;
        this.points.forEach(p => {
            let k = 100 - p[4]
            centerx += (p[0] - p[2]) * k
            centery += (p[1] - p[3]) * k
            maxx = Math.max(maxx, (p[0] - p[2]));
            maxy = Math.max(maxy, (p[1] - p[3]));
            centerx += p[4]
            dist += k
        })
        centerx = centerx / koefs;
        centery = centery / koefs;
        dist = dist / this.points.length;
        return [centerx, centery, maxx, maxy, koefs, dist]
    }
}
module.exports.Image = Image
module.exports.MotionImage = MotionImage
