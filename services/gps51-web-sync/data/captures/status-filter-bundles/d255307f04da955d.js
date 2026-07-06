(function (window) {
    //兼容
    window.URL = window.URL || window.webkitURL;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

    var HZRecorder = function (stream, outputConfig) {
        outputConfig = outputConfig || {};
        outputConfig.sampleBits = outputConfig.sampleBits || 8; //默认 采样数位 8, 16，外面调用指定16位的pcm
        outputConfig.sampleRate = outputConfig.sampleRate || 44100 / 6; //采样率(1/6 44100) 外面指定用8000赫兹的采样率

        var context = new (window.webkitAudioContext || window.AudioContext)();
        var audioInput = context.createMediaStreamSource(stream);
        var createScript = context.createScriptProcessor || context.createJavaScriptNode;
        //配置缓冲区大小和声道数
        var recorder = createScript.apply(context, [4096, 1, 1]);

        lame = new lamejs();
        mp3Encoder = new lame.Mp3Encoder(1, outputConfig.sampleRate || 44100, outputConfig.sampleBits || 128);

        var floatTo16BitPCM = function (input, output) {
            for (var i = 0; i < input.length; i++) {
                var s = Math.max(-1, Math.min(1, input[i]));
                output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
        };

        var convertBuffer = function (arrayBuffer) {
            var data = new Float32Array(arrayBuffer);
            var out = new Int16Array(arrayBuffer.length);
            floatTo16BitPCM(data, out);
            return out;
        };

        var encodeMP3 = function (arrayBuffer) {
            var transformData = [];
            var maxSamples = 1152;
            var samplesMono = convertBuffer(arrayBuffer);
            var remaining = samplesMono.length;
            for (var i = 0; remaining >= 0; i += maxSamples) {
                var left = samplesMono.subarray(i, i + maxSamples);
                var mp3buf = mp3Encoder.encodeBuffer(left);
                transformData.push(mp3buf);
                remaining -= maxSamples;
            }
            // transformData.push(mp3Encoder.flush());
            return transformData;
        };
        var audioData = {
            isrecording: false,
            size: 0, //录音文件长度
            buffer: [], //录音缓存
            callback: outputConfig.callback,
            inputSampleRate: context.sampleRate, //浏览器自带的输入采样率

            inputSampleBits: 16, //输入采样数位 8, 16

            outputSampleRate: outputConfig.sampleRate, //输出采样率

            oututSampleBits: outputConfig.sampleBits, //输出采样数位 8, 16

            input: function (data) {
                this.buffer.push(new Float32Array(data));
                this.size += data.length;
                this.flushToCallBack();
            },

            flushToCallBack: function () {
                var dataView = this.encodePCMS16();
                this.callback && this.callback(outputConfig.sampleRate, outputConfig.sampleBits, -1, dataView);
                this.buffer = [];
                this.size = 0;
            },
            compress: function () {
                //合并压缩
                //合并
                var data = new Float32Array(this.size);
                var offset = 0;
                for (var i = 0; i < this.buffer.length; i++) {
                    data.set(this.buffer[i], offset);
                    offset += this.buffer[i].length;
                }
                //压缩
                var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
                var length = data.length / compression;
                var result = new Float32Array(length);
                var index = 0,
                    j = 0;
                while (index < length) {
                    result[index] = data[j];
                    j += compression;
                    index++;
                }
                return result;
            },

            encodePCMS16: function () {
                var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
                var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
                var bytes = this.compress();
                var dataLength = bytes.length * (sampleBits / 8);
                var buffer = new ArrayBuffer(dataLength);
                var data = new DataView(buffer);

                var channelCount = 1; //单声道
                var offset = 0;

                // 写入采样数据
                if (sampleBits === 8) {
                    for (var i = 0; i < bytes.length; i++, offset++) {
                        var s = Math.max(-1, Math.min(1, bytes[i]));
                        var val = s < 0 ? s * 0x8000 : s * 0x7fff;
                        val = parseInt(255 / (65535 / (val + 32768)));
                        data.setInt8(offset, val, true);
                    }
                } else {
                    for (var i = 0; i < bytes.length; i++, offset += 2) {
                        var s = Math.max(-1, Math.min(1, bytes[i]));
                        data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
                    }
                }

                return data;
            },

            encodeMP3: function () {
                var that = this;
                var mp3Buffer = encode(this.buffer);
                var blob = new Blob(mp3Buffer, {
                    type: 'audio/mp3'
                });
                var reader = new FileReader();
                reader.readAsArrayBuffer(blob);
                reader.onload = function (e) {
                    var buf = new Uint8Array(reader.result);
                    var dataLength = buf.length;
                    that.callback && that.callback(outputConfig.sampleRate, outputConfig.sampleBits, dataLength, buf);
                };
            }
        };

        //开始录音
        this.start = function () {
            audioData.isrecording = true;
            audioInput.connect(recorder);
            recorder.connect(context.destination);
        };

        //停止
        this.stop = function () {
            audioData.isrecording = false;
            setTimeout(() => {
                if (audioData.isrecording == false) {
                    recorder.disconnect();
                    console.log('recorder real stop');
                }
            }, 1000);

            // audioData.flushToCallBack();
        };

        //音频采集
        recorder.onaudioprocess = function (e) {
            audioData.input(e.inputBuffer.getChannelData(0));
            //record(e.inputBuffer.getChannelData(0));
        };
    };

    HZRecorder.errorTips = '';

    //抛出异常
    HZRecorder.throwError = function (message) {
        console.log(' HZRecorder.throwError =' + message);
        // HZRecorder.errorTips = message;
        window.isRecordingRights = false;
        // new Vue().$Message.error(message);
        // throw new function () { this.toString = function () { return message; } }
    };

    //是否支持录音
    HZRecorder.canRecording = navigator.getUserMedia != null;
    //获取录音机
    HZRecorder.get = function (callback, outputConfig) {
        if (callback) {
            if (navigator.getUserMedia) {
                navigator.getUserMedia(
                    {
                        audio: true
                    }, //只启用音频

                    function (stream) {
                        window.isRecordingRights = true;
                        var rec = new HZRecorder(stream, outputConfig);
                        callback(rec);
                    },
                    function (error) {
                        switch (error.code || error.name) {
                            case 'PERMISSION_DENIED':
                            case 'PermissionDeniedError':
                                HZRecorder.throwError('用户拒绝提供信息。');
                                HZRecorder.errorTips = 'recorderErrorTips1';
                                break;
                            case 'NOT_SUPPORTED_ERROR':
                            case 'NotSupportedError':
                                HZRecorder.throwError('浏览器不支持硬件设备。');
                                HZRecorder.errorTips = 'recorderErrorTips2';
                                break;
                            case 'MANDATORY_UNSATISFIED_ERROR':
                            case 'MandatoryUnsatisfiedError':
                                HZRecorder.throwError('无法发现指定的硬件设备。');
                                HZRecorder.errorTips = 'recorderErrorTips3';
                                break;
                            case 8:
                                HZRecorder.throwError('没有检测到录音设备,无法录音。');
                                HZRecorder.errorTips = 'recorderErrorTips4';
                                break;
                            default:
                                HZRecorder.throwError('无法打开麦克风。异常信息:' + (error.code || error.name));
                                HZRecorder.errorTips = 'recorderErrorTips5';
                                break;
                        }
                    }
                );
            } else {
                window.isRecordingRights = false;
                HZRecorder.errorTips = 'recorderErrorTips6';
                // HZRecorder.throwError('当前浏览器不支持录音功能。');
                return;
            }
        }
    };

    // 判断端字节序
    HZRecorder.littleEdian = (function () {
        var buffer = new ArrayBuffer(2);
        new DataView(buffer).setInt16(0, 256, true);
        return new Int16Array(buffer)[0] === 256 ? 1 : 0;
    })();

    window.HZRecorder = HZRecorder;
})(window);
