export default function CoreOverviewImg(props) {
  // const Svg = require(`@site/static/${props.img}`).default;
  // const Svg = require(`@site/static/img/undraw_spreadsheet_2.svg`).default;
  /**
   * Probably a correct way to import this but for now...
   */
  const Svg = require(`@site/static/img/concepts-overview.svg`).default;
  return (
    <Svg {...props}/>
  );
}

