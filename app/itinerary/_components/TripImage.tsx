import type { ImageView } from "../itinerary-view";
import SceneArt from "./SceneArt";

/**
 * The photo over its drawn scenery, which shows when there is no photo or it
 * fails to load. Fills its parent, which has to be positioned.
 */
export default function TripImage({ image }: { image: ImageView }) {
  return (
    <>
      <SceneArt scene={image.scene} />
      {image.photoUrl && (
        // Hotel photos come from whichever host Duffel's suppliers use, which next/image would need listed.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
      )}
    </>
  );
}
