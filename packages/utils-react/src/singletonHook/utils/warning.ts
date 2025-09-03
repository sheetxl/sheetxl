
export const warning = (message: any) => {
  if (console && console.warn) {
    console.warn(message);
  }
};
