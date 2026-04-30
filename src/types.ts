import { Vector3, Euler } from 'three';

export type PartType = 'block' | 'cylinder' | 'hex_nut' | 'hole_block' | 'hole_cylinder';

export interface CADPart {
  id: string;
  name: string;
  type: PartType;
  position: [number, number, number];
  rotation: [number, number, number]; // Radians
  scale: [number, number, number];
  color: string;
  visible: boolean;
  opacity: number;
}

export interface PanConfig {
  bottomDiameter: number; 
  topDiameter: number;    
  height: number;         
  curveRadius: number;   
  rimThickness: number;
  bottomFilletRadius: number;
  addRim: boolean;
  rimHeight: number;
}

export interface TubeConfig {
  width: number;          
  height: number;         
  thickness: number;      
  totalLength: number;         
  partLength: number;
  cornerRadius: number;
  shape: 'دائري' | 'بيضاوي' | 'مخصص';
  customStlBuffer?: ArrayBuffer;
  customStlName?: string;
}

export interface AssemblyConfig {
  tiltAngle: number;
  handleAngleX: number;
  handleAngleY: number;
  handleOffset: number;
  insertionDistance: number;
  heightOffset: number;
  tiltAxis: 'X' | 'Y';
}

export interface ZeroGapState {
  pan: PanConfig;
  tube: TubeConfig;
  assembly: AssemblyConfig;
  renderMode: 'preview' | 'boolean';
  addFillet: boolean;
  thermalClearance: boolean;
  nestingMode: 'single' | 'twin';
  slugGap: number;
  markOrientation: boolean;
}

export interface CADState {
  parts: CADPart[];
  selectedPartId: string | null;
  viewMode: '3d' | 'drafting' | 'cnc' | 'viewer';
  gridVisible: boolean;
  units: 'mm' | 'inch';
  zeroGap: ZeroGapState;
}
