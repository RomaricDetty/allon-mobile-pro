import React from 'react';
import { Image, TouchableOpacity } from 'react-native';

import { Marker } from 'react-native-maps';

interface UserMarkerProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
}

const UserMarker: React.FC<UserMarkerProps> = ({region}) => {
  return (
    <Marker coordinate={region} tracksViewChanges={false} style={{zIndex: 200}}>
      <TouchableOpacity style={{}}>
        <Image
          source={require("@/assets/images/transport.png")}
          resizeMethod="resize"
          style={{width: 50, height: 50}}
        />
      </TouchableOpacity>
    </Marker>
  );
};

export default UserMarker;