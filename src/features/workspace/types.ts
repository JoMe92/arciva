export type ImgType = 'JPEG' | 'RAW'
export type ColorTag = 'None' | 'Red' | 'Green' | 'Blue' | 'Yellow' | 'Purple'

export type Photo = {
  id: string
  name: string
  type: ImgType
  date: string // ISO
  rating: 0 | 1 | 2 | 3 | 4 | 5
  picked: boolean
  rejected: boolean
  tag: ColorTag
  src: string
}
