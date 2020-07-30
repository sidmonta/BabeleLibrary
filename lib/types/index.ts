export type DeweyCategory = {
    dewey: string
    name: string
    parent: string
    hierarchy: DeweyCategory[]
    haveChildren: boolean
}
