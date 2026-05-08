import * as Location from "expo-location";

export const DEFAULT_LATITUDE_DELTA = 0.0922;
export const LOCATION_CONFIG: Location.LocationOptions = {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 5,
};
export const MIN_ACCURACY = 100;
export const MIN_DISTANCE_THRESHOLD = 0;
export const MAX_SPEED = 50;
export const WARMUP_UPDATES = 3;
export const DEFAULT_COORDS = { latitude: 5.320357, longitude: -4.016107 };

export interface LocationData {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
    heading: number | null;
    speed: number | null;
    accuracy: number | null;
}

export type RouteAction = "boarding" | "startRoute" | "finishRoute";
export const CONFIRM_MESSAGES: Record<RouteAction, string> = {
    boarding: "Êtes-vous sûr de vouloir démarrer l'embarquement ?",
    finishRoute: "Êtes-vous sûr de vouloir terminer le départ ?",
    startRoute: "Êtes-vous sûr de vouloir démarrer le départ ?",
};
export const ACTION_COLORS: Record<RouteAction, string> = {
    boarding: "#1776BA",
    finishRoute: "#E74C3C",
    startRoute: "#43b860",
};
