import Constants from "expo-constants";

/** Clé Mapbox lue depuis app.json (extra.RNMBX_MAPBOX_TOKEN) ou plugin @rnmapbox/maps */
export function getMapboxAccessToken(): string {
    const token = Constants.expoConfig?.extra?.RNMBX_MAPBOX_TOKEN as string | undefined;
    if (token) return token;
    throw new Error("RNMBX_MAPBOX_TOKEN manquant. Définir extra.RNMBX_MAPBOX_TOKEN dans app.json (même valeur que le plugin @rnmapbox/maps).");
}
