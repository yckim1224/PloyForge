import riftingRaw from './rifting-2d.poly?raw'
import threeLayerRaw from './test-three-layer.poly?raw'
import terrigenousRaw from './terrigenous.poly?raw'
import rsfRaw from './rsf_long_strike_model_low_resolution.poly?raw'
import staticTerrigRaw from './test_static_terrig.poly?raw'
import sedimentaryRaw from './sedimentary_basin.poly?raw'

export interface SampleEntry {
  id: string
  name: string
  description: string
  content: string
}

export const SAMPLES: SampleEntry[] = [
  {
    id: 'rifting-2d',
    name: 'Rifting 2D',
    description: '500 x 150 km, two layers, 4 regions',
    content: riftingRaw,
  },
  {
    id: 'test-three-layer',
    name: 'Three layer',
    description: 'Upper / lower crust + lithospheric mantle',
    content: threeLayerRaw,
  },
  {
    id: 'terrigenous',
    name: 'Terrigenous',
    description: 'Surface topography over crust + mantle',
    content: terrigenousRaw,
  },
  {
    id: 'rsf-long-strike',
    name: 'RSF long strike',
    description: 'Seismogenic zone split into VS / VW / VS',
    content: rsfRaw,
  },
  {
    id: 'static-terrig',
    name: 'Static terrigenous',
    description: 'Topographic ridges with surface segments',
    content: staticTerrigRaw,
  },
  {
    id: 'sedimentary-basin',
    name: 'Sedimentary basin',
    description: 'Layered crust and mantle',
    content: sedimentaryRaw,
  },
]
