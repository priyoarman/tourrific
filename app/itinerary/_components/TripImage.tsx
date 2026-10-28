import type { ImageView } from "../itinerary-view";
import SceneArt from "./SceneArt";

export default function TripImage({ image }: { image: ImageView }) {
  return (
    <>
      <SceneArt scene={image.scene} />
      {image.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
      )}
    </>
  );
}
