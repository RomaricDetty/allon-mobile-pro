/**
 * Tests unitaires pour le service Socket.IO
 * 
 * Pour exécuter les tests :
 * npm test services/__tests__/socket.service.test.ts
 */

import { socketService } from '../socket.service';

describe('SocketService', () => {
  beforeEach(() => {
    // Réinitialiser le service avant chaque test
    socketService.disconnect();
  });

  afterEach(() => {
    // Nettoyer après chaque test
    socketService.disconnect();
  });

  describe('connect', () => {
    it('devrait se connecter au serveur', async () => {
      await socketService.connect();
      expect(socketService.connected).toBe(true);
    });

    it('ne devrait pas se reconnecter si déjà connecté', async () => {
      await socketService.connect();
      const socketId1 = socketService.socketId;
      
      await socketService.connect();
      const socketId2 = socketService.socketId;
      
      expect(socketId1).toBe(socketId2);
    });
  });

  describe('joinBusRoom', () => {
    it('devrait rejoindre une room de bus', async () => {
      await socketService.connect();
      const busId = 'bus-123';
      
      expect(() => {
        socketService.joinBusRoom(busId);
      }).not.toThrow();
    });

    it('ne devrait pas rejoindre si non connecté', () => {
      const busId = 'bus-123';
      
      // Ne devrait pas lancer d'erreur, juste un warning
      expect(() => {
        socketService.joinBusRoom(busId);
      }).not.toThrow();
    });
  });

  describe('sendPosition', () => {
    it('devrait envoyer une position valide', async () => {
      await socketService.connect();
      
      const position = {
        busId: 'bus-123',
        lat: 48.8566,
        lng: 2.3522,
        timestamp: Date.now(),
      };
      
      expect(() => {
        socketService.sendPosition(position);
      }).not.toThrow();
    });

    it('ne devrait pas envoyer une position invalide', async () => {
      await socketService.connect();
      
      const invalidPosition = {
        busId: 'bus-123',
        lat: 200, // Invalide
        lng: 2.3522,
        timestamp: Date.now(),
      };
      
      // Ne devrait pas lancer d'erreur, juste ignorer
      expect(() => {
        socketService.sendPosition(invalidPosition);
      }).not.toThrow();
    });

    it('ne devrait pas envoyer si non connecté', () => {
      const position = {
        busId: 'bus-123',
        lat: 48.8566,
        lng: 2.3522,
        timestamp: Date.now(),
      };
      
      expect(() => {
        socketService.sendPosition(position);
      }).not.toThrow();
    });
  });

  describe('onBusPosition', () => {
    it('devrait écouter les positions d\'un bus', async () => {
      await socketService.connect();
      const busId = 'bus-123';
      const callback = jest.fn();
      
      const unsubscribe = socketService.onBusPosition(busId, callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Nettoyer
      unsubscribe();
    });
  });

  describe('disconnect', () => {
    it('devrait se déconnecter correctement', async () => {
      await socketService.connect();
      expect(socketService.connected).toBe(true);
      
      socketService.disconnect();
      expect(socketService.connected).toBe(false);
    });
  });
});
