const ReactNative = require('react-native');

function animationBuilder() {
  const builder = {
    delay: () => builder,
    duration: () => builder,
    easing: () => builder,
    springify: () => builder,
  };
  return builder;
}

const Animated = ReactNative.Animated;

module.exports = {
  __esModule: true,
  default: Animated,
  Easing: ReactNative.Easing,
  FadeIn: animationBuilder(),
  FadeInDown: animationBuilder(),
  FadeInRight: animationBuilder(),
  FadeOutUp: animationBuilder(),
  cancelAnimation: jest.fn(),
  useAnimatedStyle: (updater) => updater(),
  useReducedMotion: () => false,
  useSharedValue: (value) => ({ value }),
  withRepeat: (animation) => animation,
  withSpring: (value, _config, callback) => {
    callback?.(true);
    return value;
  },
  withTiming: (value, _config, callback) => {
    callback?.(true);
    return value;
  },
};
