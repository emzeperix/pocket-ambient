import React, { createContext, useReducer } from "react";

export const MyAudioContext = createContext();

const fade = (state, channel, variation, nextVariation) => {
  const step = 0.01;
  let fOut = setInterval(() => {
    const gain = channel.variation[variation].variationGain.gain.value;
    channel.variation[variation].variationGain.gain.setValueAtTime(
      gain - step,
      state.audioContext.currentTime
    );
    if (channel.variation[variation].variationGain.gain.value < 0.01) {
      clearInterval(fOut);
    }
  }, 30);
  let fIn = setInterval(() => {
    const gain = channel.variation[nextVariation].variationGain.gain.value;
    channel.variation[nextVariation].variationGain.gain.setValueAtTime(
      gain + step,
      state.audioContext.currentTime
    );
    if (channel.variation[nextVariation].variationGain.gain.value > 0.99) {
      clearInterval(fIn);
    }
  }, 30);
};

const modulateLpf = (lpf, freq, rate, offset) => {
  let alpha = offset;
  let sinMod = setInterval(() => {
    lpf.frequency.value = freq + Math.sin(alpha) * 4900;
    alpha += rate;
  }, 100);
};

const playSamples = (variation, ac) => {
  variation.nodes.forEach((node, index) => {
    node.sourceNode.loop = true;
    node.sourceNode.start(ac.currentTime + index * 10);
  });
} 

const modulateGain = (variant) => {};

const modulatePitch = (variant) => {};

const initialState = {
  audioContext: "",
  channels: [],
  isSetup: false,
  playedOnce: false,
  isPlaying: false,
};

const reducer = (state, action) => {
  switch (action.type) {
    case "MOUNT_AC":
      return {
        ...state,
        audioContext: action.ac,
        channels: action.buffers,
        isSetup: true,
      };
    case "PLAY":
      state.channels.forEach((channel, index) => {

        channel.channelGain.gain.setValueAtTime(
          channel.volume / 100,
          state.audioContext.currentTime
        );
        if (channel.globalRules.modulateLpf) {
          let freq = channel.lpf.frequency.value;
          modulateLpf(channel.lpf, freq, 0.006, -index);
        }
        if (channel.globalRules.multiSample && !state.playedOnce) {
          channel.variation.forEach((v) => {
            playSamples(v, state.audioContext);
          })
        }
      });
      return {
        ...state,
        playedOnce: true,
        isPlaying: true,
      };
    case "STOP":
      state.channels.forEach((channel) => {
        channel.channelGain.gain.setValueAtTime(
          0,
          state.audioContext.currentTime
        );
      });
      return {
        ...state,
        isPlaying: false,
      };
    case "SET_VOLUME":
      if (state.isPlaying) {
        state.channels[action.idx].channelGain.gain.setValueAtTime(
          action.payload / 100,
          state.audioContext.currentTime
        );
      }

      return {
        ...state,
        channels: state.channels.map((channel, i) =>
          i === action.idx ? { ...channel, volume: action.payload } : channel
        ),
      };
    case "SET_VAR":
      const activeVar = state.channels[action.channelIdx].activeVar;
      fade(state, state.channels[action.channelIdx], activeVar, action.varIdx);
      return {
        ...state,
        channels: state.channels.map((channel, i) =>
          i === action.channelIdx
            ? { ...channel, activeVar: action.varIdx }
            : channel
        ),
      };
    default:
      return;
  }
};

export const MyAudioContextProvider = (props) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <MyAudioContext.Provider value={[state, dispatch]}>
      {props.children}
    </MyAudioContext.Provider>
  );
};
