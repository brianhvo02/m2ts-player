import * as Comlink from 'comlink';

const PACKET_COUNT = Math.floor(2**30 / 192);
const PACKET_SIZE = PACKET_COUNT * 192;

enum StreamType {
  VIDEO_H264 = 0x1B,
  VIDEO_H265 = 0x24,
  AUDIO_PCM = 0x80,
  AUDIO_DOLBY_DIGITAL,
  AUDIO_DTS_6CH,
  AUDIO_DOLBY_TRUEHD,
  AUDIO_DOLBY_DIGITAL_PLUS,
  AUDIO_DTS_8CH,
  AUDIO_DTS_8CH_LOSSLESS,
  PRESENTATION_GRAPHIC = 0x90,
};

const BITS_PER_SAMPLE = [0, 16, 20, 24];
export enum ChannelLayouts {
  MONO = 1, STEREO = 3, SURROUND,
  LAYOUT_2_1, LAYOUT_4_0, LAYOUT_2_2,
  LAYOUT_5_0, LAYOUT_5_1, LAYOUT_7_0,
  LAYOUT_7_1,
}

const SAMPLE_RATES = [null, 48000, null, null, 96000, 192000];

const valueToHex = function(value: number, byteCount: number) {
  return '0x' + value.toString(16).padStart(byteCount * 2, '0').toUpperCase();
}

export class Demuxer extends EventTarget {
  private pmtPid = 0x0000;
  private nitPid = 0x0000;
  private pcrPid = 0x0000;
  private streams: Set<number> = new Set();
  private streamMap: Record<number, StreamType> = {};
  private chunksMap: Record<number, Uint8Array<ArrayBuffer>[]> = {};
  private buffersCreated: Record<number, boolean> = {};
  private audioOffset: Record<number, number> = {};

  private videoInit = false;
  private videoConf = false;

  private file: File;

  constructor(file: File) {
    super();

    this.file = file;
  }

  async demux(
    configure: Comlink.Local<(codec: string) => void>,
    flush: Comlink.Local<() => void>,
    decode: Comlink.Local<(chunk: EncodedVideoChunk) => void>,
    createBuffer: Comlink.Local<(
      pid: number, sampleRate: number, numOfChannels: number
    ) => boolean>,
    addToBuffer: Comlink.Local<(
      pid: number, channels: Float32Array<ArrayBuffer>[], audioOffset: number
    ) => void>,
  ) {
    // const opfs = await navigator.storage.getDirectory();
    // const fh = await opfs.getFileHandle('test.raw', { create: true });
    // const ws = await fh.createWritable();

    const maxCount = Math.ceil(this.file.size / PACKET_SIZE);
    for (let j = 0; j < maxCount; j++) {
      const progress: Record<number, boolean> = {};
      const buf = await this.file.slice(j * PACKET_SIZE, (j + 1) * PACKET_SIZE).arrayBuffer();
      console.log(`Loading complete: ${j + 1}/${maxCount}`);
      
      const maxPacket = j === maxCount - 1
        ? buf.byteLength / 192
        : PACKET_COUNT;

      for (let i = 0; i < maxPacket; i++) {
        const percent = Math.floor(i / maxPacket * 100);
        if (percent % 10 === 0 && !progress[percent]) {
          progress[percent] = true;
          console.log(`${percent}% demuxed.`);
        }

        const packet = new Uint8Array(buf.slice(i * 192, (i + 1) * 192));
        const view = new DataView(packet.buffer);

        // const extraHeader = view.getUint32(0);
        const syncByte = view.getUint8(4);

        if (syncByte !== 0x47)
          console.error('Packet not in sync.');

        const valIdx5 = view.getUint16(5);
        // const transportErrorIndicator = Boolean(valIdx5 & 0x8000);
        const payloadUnitStartIndicator = Boolean(valIdx5 & 0x4000);
        // const transportPriority = Boolean(valIdx5 & 0x2000);
        const pid = valIdx5 & 0x1FFF;

        const valIdx7 = view.getUint8(7);
        // const transportScramblingControl = (valIdx7 & 0xC0) >> 6;
        const adaptationFieldControl = (valIdx7 & 0x30) >> 4;
        // const continuityCounter = valIdx7 & 0xF;

        const payloadStart = ((adaptationFieldControl & 0b10) ? view.getUint8(8) + 1 : 0) + 8;

        if (adaptationFieldControl & 0b10) {
            // const adaptationFieldLength = view.getUint8(8);
            // const valIdx9 = view.getUint8(9);
            // const discontinuityIndicator = Boolean(valIdx9 & 0x80);
            // const randomAccessIndicator = Boolean(valIdx9 & 0x40);
            // const elementaryStreamPriorityIndicator = Boolean(valIdx9 & 0x20);
            // const pcrFlag = Boolean(valIdx9 & 0x10);
            // const opcrFlag = Boolean(valIdx9 & 0x08);
            // const splicingPointFlag = Boolean(valIdx9 & 0x04);
            // const transportPrivateDataFlag = Boolean(valIdx9 & 0x02);
            // const adaptationFieldExtensionFlag = Boolean(valIdx9 & 0x01);
            // const valIdx10 = view.getBigUint64(10);
            // if (opcrFlag || splicingPointFlag || transportPrivateDataFlag || adaptationFieldExtensionFlag)
            //     console.log('hey!', pcrFlag, opcrFlag, splicingPointFlag, transportPrivateDataFlag, adaptationFieldExtensionFlag)
            // const pcrRaw = (valIdx10 & 0xFFFFFFFFFFFF0000n) >> 16n;
            // const pcrBase = (valIdx10 & 0xFFFFFF8000000000n) >> 39n;
            // const pcrReserved = (valIdx10 & 0x000000007E000000n) >> 34n;
            // const pcrExtension = (valIdx10 & 0x0000000001FF0000n) >> 16n;
            // const pcr = pcrBase * 300n + pcrExtension;
            
            // if (pid === this.pcrPid) {
            //   console.log(pcr)
            // }
        }

        if (!(adaptationFieldControl & 0b01)) 
          continue;

        if (pid === 0x0000 || pid === this.pmtPid) {
          if (!payloadUnitStartIndicator) {
            console.error('Additional table data handling not implemented.');
            continue;
          }
          const offset = view.getUint8(payloadStart);
          const total = payloadStart + offset + 1;
          const payload = new Uint8Array(packet.buffer.slice(total));
          const payloadView = new DataView(payload.buffer);
          const tableId = payloadView.getUint8(0);
          const valIdx1 = payloadView.getUint16(1);
          const sectionSyntaxIndicator = Boolean(valIdx1 & 0x8000);
          // const privateBit = Boolean(valIdx1 & 0x4000);
          const reservedPsi = (valIdx1 & 0x3000) >> 12;
          if (reservedPsi !== 0x03)
            console.error('Invalid reserved bits.');
          const sectionLength = (valIdx1 & 0x03FF);

          // const tableIdExtension = sectionSyntaxIndicator ? 
          //     payloadView.getUint16(3) : null;
          const valIdx5 = sectionSyntaxIndicator ? 
            payloadView.getUint8(5) : null;
          const reservedExt = valIdx5 ?
            (valIdx5 & 0xC0) >> 6 : null;
          if (!(reservedExt === null || reservedExt === 0x03))
            console.error('Invalid reserved bits.');
          // const versionNumber = valIdx5 ?
          //     (valIdx5 & 0x3E) >> 1 : null;
          // const currentNextIndicator = valIdx5 ?
          //     valIdx5 & 0x01 : null;
          // const sectionNumber = sectionSyntaxIndicator ? 
          //     payloadView.getUint8(6) : null;
          // const lastSectionNumber = sectionSyntaxIndicator ? 
          //     payloadView.getUint8(7) : null;

          const dataIdx = Number(sectionSyntaxIndicator) * 5 + 3;
          switch (tableId) {
            case 0: {
              // console.log('Detected PAT.');
              
              for (let i = 0; i < (sectionLength - dataIdx + 3) / 4 - 1; i++) {
                const programNumber = payloadView.getUint16(dataIdx + 4 * i);
                const rest = payloadView.getUint16(dataIdx + 4 * i + 2);
                const reservedPat = (rest & 0xE000) >> 13;
                if (reservedPat !== 0x07)
                  console.error('Invalid reserved bits.');
                const programMapPid = rest & 0x1FFF;

                if (programNumber)
                  this.pmtPid = programMapPid;
                else
                  this.nitPid = programMapPid;

                // console.log('Program Number:', valueToHex(programNumber, 2));
                // console.log('Program Map PID:', valueToHex(programMapPid, 2));
              }

              break;
            }
            
            case 2: {
              // console.log('Detected PMT.');
              const valIdx0 = payloadView.getUint16(dataIdx);
              const reservedPmt1 = (valIdx0 & 0xE000) >> 13;
              if (reservedPmt1 !== 0x07)
                console.error('Invalid reserved bits.');
              this.pcrPid = valIdx0 & 0x1FFF;

              const valIdx2 = payloadView.getUint16(dataIdx + 2);
              const reservedPmt2 = (valIdx2 & 0xF000) >> 12;
              if (reservedPmt2 !== 0x0F)
                console.error('Invalid reserved bits.');
              const programInfoLength = valIdx2 & 0x03FF;

              let infoRead = 0;
              while (infoRead < programInfoLength) {
                const idx = dataIdx + 4 + infoRead;
                // const descriptorTag = payloadView.getUint8(idx);
                const descriptorLength = payloadView.getUint8(idx + 1);
                // const descriptorData = payload.slice(idx + 2, idx + 2 + descriptorLength);
                infoRead += 2 + descriptorLength;
              }

              const cur = dataIdx + programInfoLength + 4;
              infoRead = 0;
              while (infoRead < sectionLength - (cur - 3) - 4) {
                const idx = dataIdx + programInfoLength + 4 + infoRead;
                const streamType = payloadView.getUint8(idx);
                const elementaryPid = payloadView.getUint16(idx + 1) & 0x1FFF;

                // console.log('Stream Type:', StreamType[streamType]);
                // console.log('Elementary PID:', valueToHex(elementaryPid, 2));
                this.streamMap[elementaryPid] ??= streamType;
                this.chunksMap[elementaryPid] ??= [];
                this.streams.add(elementaryPid);

                if (streamType === StreamType.VIDEO_H264 && !this.videoConf) {
                  await configure('avc1.640029');
                  this.videoConf = true;
                }
                if (streamType === StreamType.VIDEO_H265 && !this.videoConf) {
                  await configure('hvc1.1.6.L186.B0');
                  this.videoConf = true;
                }
                
                const esInfoLength = payloadView.getUint16(idx + 3) & 0x03FF;
                infoRead += 5 + esInfoLength;
              }

              break;
            }
          }
          
          // const crc32 = payload.slice(sectionLength - 4, sectionLength);
          continue;
        }

        if (pid === this.nitPid || pid === this.pcrPid || pid === 0x1FFF) // Null packet
          continue;

        if (!this.streams.has(pid)) {
          console.error('Unknown pid:', valueToHex(pid, 2));
          continue;
        }
        
        if (payloadUnitStartIndicator && this.chunksMap[pid].length) {
          const packet = new Uint8Array(this.chunksMap[pid].reduce((total, arr) => total + arr.length, 0));
          const packetView = new DataView(packet.buffer);
          this.chunksMap[pid].reduce((idx, chunk) => {
            packet.set(chunk, idx);
            return idx + chunk.length;
          }, 0);

          if (packet[0] !== 0x00 || packet[1] !== 0x00 || packet[2] !== 0x01) {
            console.log('Invalid packet start code (0x000001).');
            continue;
          }

          // const streamId = packetView.getUint8(3);
          // const packetLength = packetView.getUint16(4);
          const header = packetView.getUint16(6);
          const ptsDtsIndicator = (header & 0xC0) >> 6;
          const headerLength = packetView.getUint8(8);
          const timestamp = ptsDtsIndicator ? Number(
            (BigInt(packet[9]) & 0x0En) << 30n |
            (BigInt(packetView.getUint16(10)) & 0xFFFEn) << 15n |
            (BigInt(packetView.getUint16(12)) & 0xFFFEn)
          ) : null;

          if (!timestamp) {
            console.error('No PTS in PES packet.');
            return;
          }

          const data = packet.slice(9 + headerLength);

          switch (this.streamMap[pid]) {
            case StreamType.VIDEO_H264: {
              // console.log('video', timestamp)
              if (this.videoInit && data[5] === 0x10)
                await flush();
              
              await decode(new EncodedVideoChunk({
                type: data[5] === 0x10 ? 'key' : 'delta',
                timestamp,
                data,
              }));

              if (!this.videoInit)
                this.videoInit = true;
              break;
            }
            case StreamType.AUDIO_PCM: {
              // console.log('audio', timestamp)
              const pcmHeader = data.slice(0, 4);
              const audio = data.slice(4);

              const channelLayout = pcmHeader[2] >> 4;
              const numOfChannels = channelLayout === ChannelLayouts.MONO
                ? 1 : channelLayout === ChannelLayouts.STEREO
                ? 2 : null;
              if (!numOfChannels) {
                console.error('Only mono and stereo currently supported.');
                return;
              }
              const sampleRate = SAMPLE_RATES[pcmHeader[2] & 0x0F] ?? 0;
              const bitsPerSample = BITS_PER_SAMPLE[pcmHeader[3] >> 6];
              
              if ((bitsPerSample !== 24 && bitsPerSample !== 16) || sampleRate === 0) {
                console.error('PCM audio other than 16 or 24 bits not supported.');
                return;
              }
              const byteCount = bitsPerSample / 8;

              if (!this.buffersCreated[pid]) {
                this.buffersCreated[pid] = await createBuffer(
                  pid, sampleRate, numOfChannels
                );
              }

              if (!this.audioOffset[pid])
                this.audioOffset[pid] = 0;

              const channels = [...Array<Float32Array<ArrayBuffer>>(numOfChannels)]
                .map(() => new Float32Array(
                  audio.length / byteCount / numOfChannels
                ));

              for (let idx = 0; idx < audio.length / byteCount; idx++) {
                const rawVal = (
                  audio[idx * byteCount] << ((byteCount - 2) ? 16 : 8)
                ) | (
                  audio[idx * byteCount + 1] << ((byteCount - 2) ? 8 : 0)
                ) | ((byteCount - 2) ? audio[idx * 3 + 2] : 0);

                const val = audio[idx * byteCount] & 0x80 ? rawVal - (
                  (byteCount - 2) ? 0x1000000 : 0x10000
                ) : rawVal;

                channels[idx % 2][Math.floor(idx / 2)] = val / (
                  Math.pow(2, bitsPerSample - 1) - Number(val >= 0)
                );
              }

              // await ws.write(channels[0]);

              await addToBuffer(
                pid, 
                Comlink.transfer(channels, channels.map(c => c.buffer)), 
                this.audioOffset[pid],
              );

              this.audioOffset[pid] += audio.length / byteCount / numOfChannels;
              break;
            }
          }

          this.chunksMap[pid].length = 0;
        }

        this.chunksMap[pid].push(packet.slice(payloadStart));
      }
    }

    // await ws.close();
    console.log('done');
  }
}

Comlink.expose(Demuxer);