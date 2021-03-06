import { useEffect, useState } from "react";
import useStorage from "../hooks/useStorage";

const ac = new AudioContext();

const setupChannel = (channel) => {
  let ch = [];

  // setup all of the variants
  channel.variations.forEach((vari, i) => {
    // every variant has an index, its nodes, a merger, and a gain
    const variation = {
      i,
      nodes: [],
      merger: {},
      variationGain: {},
      name: vari.name,
      rules: vari.rules,
      intervalIds: []
    };
    const varChannelMerger = ac.createChannelMerger();
    const varGainNode = ac.createGain();

    // at setup everything is muted
    varGainNode.gain.setValueAtTime(0, ac.currentTime);

    // setup all of the sources
    let sourceNodes = [];
    vari.samples.forEach((sample) => {
      // delete extension from sampleNmae
      let sampleName = sample.sampleName.substring(
        0,
        sample.sampleName.length - 4
      );
     

      let node = {};
      // if a channel is multisample, aka a variant has multiple sources, then create a gain node for all of them
      // this becomes handy when their respective gains are modulated, resulting in a simulation of randomized velocity
      if (channel.globalRules.multiSample) {
        let gainNode = ac.createGain();


        gainNode.gain.setValueAtTime(1, ac.currentTime);
        gainNode.connect(varChannelMerger);
        let sampleBuffer = sample.buffer
        node = {sampleBuffer, gainNode, sampleName };

      } else {
        let sourceNode = ac.createBufferSource();
        sourceNode.buffer = sample.buffer;
        // if a variant has only one sample, then the variant gain is enough to handle the on/off state.
        sourceNode.connect(varChannelMerger);
        sourceNode.loop = true;
        node = { sourceNode, sampleName };
        node.sourceNode.start(0);
      }

      sourceNodes.push(node);
    });

    // connect the variant to the variant gain node
    varChannelMerger.connect(varGainNode);
    variation.variationGain = varGainNode;
    variation.merger = varChannelMerger;
    variation.nodes = sourceNodes;
    ch.push(variation);
  });

  return ch;
};

const useSetupAudio = () => {
  const { sampleLibrary, fbErr } = useStorage();
  const [channelBuffers, setChannelBuffers] = useState([]);
  const [audioContext, setAudioContext] = useState(null);
  const [fbErrProp, setFbErrProp] = useState(null);

  useEffect(() => {
    if (!fbErr) {
      if (sampleLibrary && sampleLibrary.sampleLibrary.length === 4) {
        let channels = [];

        // create one global reverb convolver node
        const reverbNode = ac.createConvolver();
        reverbNode.buffer = sampleLibrary.reverbBuffer;

        // iterate over each channel
        sampleLibrary.sampleLibrary.forEach((channel) => {
          // create a channelMerger and a channelGain ie: to connect all of the variant's sources into one gain node
          const channelMerger = ac.createChannelMerger();
          const channelGain = ac.createGain();

          // at setup everything is muted
          channelGain.gain.setValueAtTime(0, ac.currentTime);

          // save channelName for the context, and sort them
          let column = 0;
          let chName = "";
          switch (channel.channelName) {
            case "AMBIENCE":
              column = 0;
              chName = channel.channelName;
              break;
            case "PAD":
              column = 1;
              chName = channel.channelName;
              break;
            case "LEAD":
              column = 2;
              chName = channel.channelName;
              break;
            case "EFFECTS":
              column = 3;
              chName = channel.channelName;
              break;
            default:
              console.error("wrong channelName");
              break;
          }

          // setup all of the variants in one channel,
          // then connect all of their gain nodes to their respecive channel gain node
          let variation = setupChannel(channel);
          variation.forEach((v) => {
            v.variationGain.connect(channelMerger);
          });

          // create random config on every refresh
          const activeVar = Math.floor(Math.random() * 4);

          // set the active variation's gain to 1.
          variation[activeVar].variationGain.gain.setValueAtTime(
            1,
            ac.currentTime
          );

          // if the channel has reverb config, then connect the channel nodes to the reverb node
          // then connect the reverb node to the main channel gain
          if (channel.globalRules.reverb) {
            channelMerger.connect(reverbNode);
            reverbNode.connect(channelGain);
          } else {
            channelMerger.connect(channelGain);
          }

          // create lowpass filter node for a channel, if it's defined in its rule
          let lowpassFilterNode = {};
          if (channel.globalRules.modulateLpf) {
            lowpassFilterNode = ac.createBiquadFilter();
            lowpassFilterNode.type = "lowpass";
            lowpassFilterNode.frequency.value = 5000;
            // connect the channel gain-s to an lpf node
            channelGain.connect(lowpassFilterNode);
            lowpassFilterNode.connect(ac.destination);
          } else {
            // if there is no modulation, then simple connect the channel gain to the main destination
            channelGain.connect(ac.destination);
          }

          // add the configed channels to the global state
          channels.push({
            variation,
            column,
            chName,
            activeVar: activeVar,
            volume: 75,
            channelGain: channelGain,
            lpf: lowpassFilterNode,
            globalRules: channel.globalRules,
          });
        });

        // sort the channels
        channels.sort((a, b) => {
          return a.column - b.column;
        });
        setChannelBuffers(channels);
        setAudioContext(ac);
        setFbErrProp(false);
      }
    } else {
      setFbErrProp(true);
    }
  }, [sampleLibrary, fbErr]);

  return { channelBuffers, audioContext, fbErrProp };
};

export default useSetupAudio;
