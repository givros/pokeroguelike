// Coordinates refer to the full, unchanged official artwork, including its transparent margins.
export const BREATH_ORIGINS = Object.freeze({
  4:[.30,.38],5:[.31,.34],6:[.395,.185],58:[.47,.40],95:[.19,.62],
  130:[.22,.47],131:[.41,.29],147:[.80,.41],149:[.35,.32],
});
export function artworkAnchor({box,width,height,naturalWidth,naturalHeight,anchor,matrix=[1,0,0,1]}) {
  const fit=Math.min(width/naturalWidth,height/naturalHeight);
  const dx=(anchor[0]-.5)*naturalWidth*fit,dy=(anchor[1]-.5)*naturalHeight*fit;
  // An affine transform maps the image centre to the centre of its transformed bounds.
  // Using that centre also preserves the animated transform origin and translation.
  return {x:box.left+box.width/2+matrix[0]*dx+matrix[2]*dy,
    y:box.top+box.height/2+matrix[1]*dx+matrix[3]*dy};
}
