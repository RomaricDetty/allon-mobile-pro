/**
 * Système d'événements pour synchroniser les modifications de statut des départs
 * entre les différents écrans de l'application
 */

type DepartureStatusUpdateEvent = {
    departureId: string;
    newStatus: string;
    departure?: any; // Données complètes du départ mis à jour (optionnel)
};

type EventListener = (event: DepartureStatusUpdateEvent) => void;

class DepartureEventEmitter {
    private listeners: Set<EventListener> = new Set();

    /**
     * Écoute les mises à jour de statut des départs
     * @param listener - Fonction appelée lors d'une mise à jour
     * @returns Fonction pour se désabonner
     */
    onStatusUpdate(listener: EventListener): () => void {
        this.listeners.add(listener);
        // Retourne une fonction de désabonnement
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Émet un événement de mise à jour de statut
     * @param event - Les données de l'événement
     */
    emitStatusUpdate(event: DepartureStatusUpdateEvent): void {
        this.listeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                console.error('[DEPARTURE-EVENTS] Erreur lors de l\'exécution d\'un listener:', error);
            }
        });
    }

    /**
     * Supprime tous les listeners
     */
    removeAllListeners(): void {
        this.listeners.clear();
    }
}

// Instance singleton
export const departureEventEmitter = new DepartureEventEmitter();

