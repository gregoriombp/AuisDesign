// The drawn previews that sit on the cards' graph paper. They are pictures of
// an idea — "a project", "a folder" — built from the same tokens as the rest of
// the chrome, so they follow light and dark without an asset.

const CHART = [34, 52, 44, 66, 58, 78, 70, 96];

/** A product window in miniature. `empty` draws it as an outline waiting to be filled. */
export function ProjectPreview({ empty = false }: { empty?: boolean }) {
  return (
    <div className="mini" data-empty={empty} aria-hidden="true">
      <div className="mini-side">
        <div className="bar bar-strong" style={{ width: "62%" }} />
        <div className="bar" style={{ width: "78%" }} />
        <div className="bar" style={{ width: "54%" }} />
        <div className="bar" style={{ width: "70%" }} />
        <div className="bar" style={{ width: "46%" }} />
      </div>
      <div className="mini-main">
        <div className="bar bar-strong" style={{ width: "44%" }} />
        <div className="mini-tiles">
          {[58, 42, 50].map((width) => (
            <div className="mini-tile" key={width}>
              <div className="bar" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
        {!empty && (
          <div className="mini-chart">
            {CHART.map((height) => (
              <i key={height} style={{ height: `${height}%` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FolderPreview() {
  return <span className="folder" aria-hidden="true" />;
}
