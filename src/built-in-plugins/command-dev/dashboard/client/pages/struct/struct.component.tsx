import { Icon, Input, Tooltip, Tree } from "antd"
import { Connect } from "dob-react"
import * as React from "react"
import { pipeEvent } from "../../../../../../utils/functional"
import { PureComponent } from "../../utils/react-helper"
import * as S from "./struct.style"
import { Props, State } from "./struct.type"

interface ITreeNode {
  children?: ITreeNode[]
  key: string
  title: string
  icon?: React.ReactElement<any>
  disabled?: boolean
}

const TreeNode = Tree.TreeNode
const Search = Input.Search

const getParentKey = (key: string, tree: ITreeNode[]): string => {
  let parentKey: string
  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]
    if (node.children) {
      if (node.children.some((item: any) => item.key === key)) {
        parentKey = node.key
      } else if (getParentKey(key, node.children)) {
        parentKey = getParentKey(key, node.children)
      }
    }
  }
  return parentKey
}

const TreeIcon = (props: any) => <Icon style={{ marginRight: 5 }} {...props} />

const PlusIcon = (props: any) => (
  <S.PlusIconContainer>
    <Icon
      style={{
        color: "#369",
        cursor: "pointer",
        fontWeight: "bold"
      }}
      type="plus"
      {...props}
    />
  </S.PlusIconContainer>
)

@Connect
export class StructComponent extends PureComponent<Props, State> {
  public static defaultProps = new Props()
  public state = new State()

  public render() {
    if (
      this.props.ApplciationStore.status === null ||
      this.props.ApplciationStore.status === undefined
    ) {
      return null
    }

    const treeData = this.getTreeData()

    return (
      <S.Container>
        <S.SearchContainer>
          <Search placeholder="Search.." onChange={pipeEvent(this.onChange)} />
        </S.SearchContainer>

        <S.TreeContainer>
          <Tree
            onExpand={this.onExpand}
            expandedKeys={this.state.expandedKeys}
            autoExpandParent={this.state.autoExpandParent}
            onSelect={this.handleSelectTreeNode}
            selectedKeys={[this.props.ApplciationStore.selectedTreeKey]}
          >
            {this.loop(treeData)}
          </Tree>
        </S.TreeContainer>
      </S.Container>
    )
  }

  private getTreeData = () => {
    const treeData: ITreeNode[] = [
      {
        title: "Project",
        key: "project-root",
        icon: <TreeIcon type="chrome" />,
        children: []
      }
    ]

    const pages = this.props.ApplciationStore.status.analyseInfo
      .projectAnalysePages
      ? this.props.ApplciationStore.status.analyseInfo.projectAnalysePages.pages
      : []
    const markdownPages = this.props.ApplciationStore.status.analyseInfo
      .projectAnalyseMarkdownPages
      ? this.props.ApplciationStore.status.analyseInfo
          .projectAnalyseMarkdownPages.pages
      : []
    const allPages = [...pages, ...markdownPages]

    // Pages
    if (allPages) {
      treeData[0].children.push({
        key: "routes",
        title: `Routes (${allPages.length})`,
        icon: <TreeIcon type="share-alt" />,
        disabled: allPages.length === 0
      })
    }

    // Stores
    if (this.props.ApplciationStore.status.analyseInfo.projectAnalyseDob) {
      treeData[0].children.push({
        key: "stores",
        title: `Stores (${
          this.props.ApplciationStore.status.analyseInfo.projectAnalyseDob
            .storeFiles.length
        })`,
        icon: <TreeIcon type="database" />,
        disabled:
          this.props.ApplciationStore.status.analyseInfo.projectAnalyseDob
            .storeFiles.length === 0,
        children: this.props.ApplciationStore.status.analyseInfo.projectAnalyseDob.storeFiles.map(
          (storeFile: any, index: number) => {
            return {
              key: index,
              title: storeFile.name,
              icon: <TreeIcon type="database" />
            }
          }
        )
      })
    }

    // Components
    treeData[0].children.push({
      key: "components",
      title: `Components`,
      icon: <TreeIcon type="appstore-o" />,
      disabled: true
    })

    // Layout
    const hasLayout = this.props.ApplciationStore.status.analyseInfo
      .projectAnalyseLayout
      ? this.props.ApplciationStore.status.analyseInfo.projectAnalyseLayout
          .hasLayout
      : false
    treeData[0].children.push({
      key: "layout",
      title: `Layout`,
      icon: hasLayout ? (
        <TreeIcon type="layout" />
      ) : (
        <Tooltip title="Auto create layout files." placement="right">
          <PlusIcon onClick={this.props.ApplicationAction.createLayout} />
        </Tooltip>
      ),
      disabled: !hasLayout
    })

    // 404
    const hasNotFound = this.props.ApplciationStore.status.analyseInfo
      .projectAnalyseNotFound
      ? this.props.ApplciationStore.status.analyseInfo.projectAnalyseNotFound
          .hasNotFound
      : false
    treeData[0].children.push({
      key: "404",
      title: `404`,
      icon: hasNotFound ? (
        <TreeIcon type="file-unknown" />
      ) : (
        <Tooltip title="Auto create 404 page." placement="right">
          <PlusIcon onClick={this.props.ApplicationAction.create404} />
        </Tooltip>
      ),
      disabled: !hasNotFound
    })

    // Config
    const hasConfig = this.props.ApplciationStore.status.analyseInfo
      .projectAnalyseConfig
      ? this.props.ApplciationStore.status.analyseInfo.projectAnalyseConfig
          .hasConfig
      : false
    treeData[0].children.push({
      key: "config",
      title: `Config`,
      icon: hasConfig ? (
        <TreeIcon type="setting" />
      ) : (
        <Tooltip title="Auto create config files." placement="right">
          <PlusIcon onClick={this.props.ApplicationAction.createConfig} />
        </Tooltip>
      ),
      disabled: !hasConfig
    })

    return treeData
  }

  private getFlatData = () => {
    const dataList: Array<{
      key: string
      title: string
    }> = []

    const treeData = this.getTreeData()

    function setFlatData(eachTreeData: ITreeNode[]) {
      eachTreeData.forEach(each => {
        dataList.push({ key: each.key, title: each.title })
        if (each.children) {
          setFlatData(each.children)
        }
      })
    }

    setFlatData(treeData)
    return dataList
  }

  private onExpand = (expandedKeys: string[]) => {
    this.setState({
      expandedKeys,
      autoExpandParent: false
    })
  }

  private onChange = (value: string) => {
    const treeData = this.getTreeData()

    const expandedKeys = this.getFlatData().map(item => {
      if (item.title.indexOf(value) > -1) {
        return getParentKey(item.key, treeData)
      }
      return null
    })

    this.setState({
      expandedKeys,
      searchValue: value,
      autoExpandParent: true
    })
  }

  private loop = (data: ITreeNode[]): Array<React.ReactElement<any>> =>
    data.map(item => {
      const index = item.title.indexOf(this.state.searchValue)
      const beforeStr = item.title.substr(0, index)
      const afterStr = item.title.substr(index + this.state.searchValue.length)

      const title =
        index > -1 ? (
          <span>
            {item.icon}
            {beforeStr}
            <span style={{ color: "#f50" }}>{this.state.searchValue}</span>
            {afterStr}
          </span>
        ) : (
          <span>
            {item.icon}
            {item.title}
          </span>
        )

      const treeProps = {
        key: item.key,
        title,
        disabled: item.disabled === undefined ? false : item.disabled
      }

      if (item.children) {
        return <TreeNode {...treeProps}>{this.loop(item.children)}</TreeNode>
      }
      return <TreeNode {...treeProps} />
    })

  private handleSelectTreeNode = (selectedKeys: string[]) => {
    const selectKey = selectedKeys[0]
    this.props.ApplicationAction.setSelectedTreeKey(selectKey)
  }
}
