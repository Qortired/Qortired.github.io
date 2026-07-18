```mermaid
graph TD
    subgraph PRE["前置决策系统"]
        direction TB
        C["观察图形的排列方式"]
        C -->|一组图 / 两组图| D["一般从左往右看，然后推论"]
        C -->|三组图| E{"观察方向是什么？"}

        E --> F["上下看"]
        E --> G["左右看"]
        E --> H["按O形或米字形看（<a href='images/figure-reasoning-paths.png'>图示</a>）"]

        D --> J["看样式的数量"]
        F --> J
        G --> J
        H --> J

        J --> M["按完整数量找规律（优先选，比如有三张连续的图，就三张连续着找规律）"]
        J --> N["只看相邻样式变化"]
    end

    style PRE fill:#f7f7ff,stroke:#6c63ff,stroke-width:2px
```
