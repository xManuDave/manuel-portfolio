import { asset } from "@/lib/asset";
export const furnitureAssets = {
  armchair_pillows: "armchair_pillows",
  book_set: "book_set",
  cabinet_medium: "cabinet_medium",
  cabinet_small: "cabinet_small",
  chair_A: "chair_A",
  chair_C: "chair_C",
  chair_stool: "chair_stool",
  couch_pillows: "couch_pillows",
  lamp_standing: "lamp_standing",
  lamp_table: "lamp_table",
  pictureframe_large_A: "pictureframe_large_A",
  pictureframe_medium: "pictureframe_medium",
  pillow_A: "pillow_A",
  pillow_B: "pillow_B",
  rug_oval_A: "rug_oval_A",
  shelf_A_big: "shelf_A_big",
  shelf_A_small: "shelf_A_small",
  shelf_B_large_decorated: "shelf_B_large_decorated",
  shelf_B_small_decorated: "shelf_B_small_decorated",
  table_medium_long: "table_medium_long",
  table_low: "table_low",
  table_small: "table_small",
} as const;

export type FurnitureAssetName = keyof typeof furnitureAssets;

export function furnitureAssetPath(name: FurnitureAssetName) {
  return asset(`/models/kaykit/furniture-bits/${furnitureAssets[name]}.gltf`);
}

export const furnitureAssetNames = Object.keys(furnitureAssets) as FurnitureAssetName[];
