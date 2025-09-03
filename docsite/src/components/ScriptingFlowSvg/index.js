export default function ScriptingFlowSvg(props) {
  // const Svg = require(`@site/static/${props.img}`).default;
  // const Svg = require(`@site/static/img/undraw_spreadsheet_2.svg`).default;
  /**
   * Probably a correct way to import this but for now...
   */
  const Svg = require(`@site/static/img/scripting-flow.svg`).default;
  return (
    <Svg {...props}/>
  );
}

