declare module "react-simple-maps" {
  import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

  export type Geography = {
    rsmKey: string;
    properties?: { name?: string | null } | null;
  };

  export type ComposableMapProps = {
    width?: number;
    height?: number;
    projection?: string;
    projectionConfig?: {
      scale?: number;
    };
    translate?: [number, number];
    className?: string;
    children?: ReactNode;
  };

  export type GeographiesProps = {
    geography: string;
    children: (args: { geographies: Geography[] }) => ReactNode;
  };

  export type GeographyStyle = {
    default?: CSSProperties;
    hover?: CSSProperties;
    pressed?: CSSProperties;
  };

  export type GeographyProps = Omit<ComponentPropsWithoutRef<"path">, "style"> & {
    geography: Geography;
    fill?: string;
    opacity?: number;
    style?: GeographyStyle;
  };

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
}
