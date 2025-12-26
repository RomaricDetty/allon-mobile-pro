import React from "react";
import { Image, View } from "react-native";

import { Marker } from "react-native-maps";

interface UserMarkerProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
}

const UserMarker: React.FC<UserMarkerProps> = ({ region }) => {
  return (
    <Marker
      coordinate={region}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={true}
      style={{ zIndex: 200 }}
    >
      <View>
        <Image
          source={require("@/assets/images/bus.png")}
          resizeMethod="resize"
          resizeMode="contain"
          style={{ width: 50, height: 150 }}
        />
      </View>
    </Marker>
  );
};

export default React.memo(UserMarker);
