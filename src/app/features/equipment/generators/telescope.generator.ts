import { BrandGenerator } from "@features/equipment/generators/brand.generator";
import { TelescopeInterface, TelescopeType } from "@features/equipment/types/telescope.interface";

export class TelescopeGenerator {
  static telescope(source: Partial<TelescopeInterface> = {}): TelescopeInterface {
    return {
      id: source.id || 1,
      created: source.created || "1970-01-01",
      updated: source.updated || "1970-01-01",
      createdBy: source.createdBy || 1,
      brand: source.brand || BrandGenerator.brand().id,
      name: source.name || "Test telescope",
      image: source.image || "https://cdn.astrobin.com/images/foo.jpg",
      type: source.type || TelescopeType.REFRACTOR_ACHROMATIC,
      aperture: source.aperture || 90,
      minFocalLength: source.minFocalLength || 450,
      maxFocalLength: source.maxFocalLength || 450,
      weight: source.weight || 2
    };
  }
}