import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { BUS_LOCATION_TASK_NAME } from '@/services/location-tracking.constants';
import { locationTrackingService } from '@/services/location-tracking.service';

/**
 * Enregistre la tâche d’arrière-plan : doit être importée au démarrage de l’app (portée globale du bundle).
 */
if (!TaskManager.isTaskDefined(BUS_LOCATION_TASK_NAME)) {
    TaskManager.defineTask(BUS_LOCATION_TASK_NAME, async ({ data, error }) => {
        if (error) {
            if (__DEV__) console.warn('[LocationTrackingTask]', error);
            return;
        }
        const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
        if (!locations?.length) return;
        for (const loc of locations) {
            locationTrackingService.consumeTaskLocationUpdate(loc);
        }
    });
}
